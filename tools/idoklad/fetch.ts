/**
 * Stiahne všetky vystavené faktúry, dobropisy, kontakty, číselníky a PDF
 * z iDoklad API v3 do lokálneho priečinka (predvolene ./idoklad, je v .gitignore).
 *
 * Iba číta — v iDoklade nič nemení. Dá sa spúšťať opakovane: JSON sa prepíše,
 * už stiahnuté PDF sa preskočia.
 *
 * Použitie (z koreňa repa):
 *   pnpm idoklad:fetch
 *
 * Premenné prostredia (.env v koreni repa alebo shell):
 *   IDOKLAD_CLIENT_ID, IDOKLAD_CLIENT_SECRET   povinné (iDoklad → Nastavenia → API)
 *   IDOKLAD_APPLICATION_ID                      ak ho iDoklad pri API kľúči uvádza
 *   IDOKLAD_OUT_DIR                             predvolene ./idoklad
 *   IDOKLAD_API_URL, IDOKLAD_TOKEN_URL          iba pre testy
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const API_URL = process.env.IDOKLAD_API_URL ?? 'https://api.idoklad.cz/v3';
const TOKEN_URL = process.env.IDOKLAD_TOKEN_URL ?? 'https://identity.idoklad.cz/server/v2/connect/token';
const PAGE_SIZE = 100;
const MAX_RETRIES = 5;

interface Page<T> { Items: T[]; TotalItems: number; TotalPages: number }
interface Envelope<T> { Data: T; IsSuccess: boolean; Message?: string; ErrorCode?: unknown }
interface Doc { Id: number; DocumentNumber?: string; DateOfIssue?: string; CurrencyId?: number; Prices?: { TotalWithVat?: number } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
  try { process.loadEnvFile(); } catch { /* .env je voliteľný */ }
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) {
    console.error(`Chýba ${name}. Nastav ho v .env (pozri .env.example).`);
    process.exit(1);
  }
  return v;
}

async function getToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requireEnv('IDOKLAD_CLIENT_ID'),
    client_secret: requireEnv('IDOKLAD_CLIENT_SECRET'),
    scope: 'idoklad_api',
  });
  const appId = process.env.IDOKLAD_APPLICATION_ID?.trim();
  if (appId) body.set('application_id', appId);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `Prihlásenie zlyhalo (HTTP ${res.status}): ${text.slice(0, 500)}\n` +
        (appId ? '' : 'Tip: ak iDoklad pri API kľúči uvádza aj Application ID, nastav IDOKLAD_APPLICATION_ID.'),
    );
  }
  const json = JSON.parse(text) as { access_token?: string };
  if (!json.access_token) throw new Error(`Odpoveď bez access_token: ${text.slice(0, 500)}`);
  return json.access_token;
}

class Api {
  constructor(private token: string) {}

  async get<T>(path: string, query: Record<string, string | number> = {}): Promise<T> {
    const url = new URL(API_URL.replace(/\/$/, '') + path);
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

    for (let attempt = 1; ; attempt++) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          'X-App': 'invoices-idoklad-export',
          'X-App-Version': '1.0.0',
        },
      });
      if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt;
        console.warn(`  HTTP ${res.status} na ${url.pathname}, čakám ${Math.round(wait / 1000)} s…`);
        await sleep(wait);
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`GET ${url.pathname} → HTTP ${res.status}: ${text.slice(0, 500)}`);
      const env = JSON.parse(text) as Envelope<T>;
      if (env.IsSuccess === false) throw new Error(`GET ${url.pathname} → ${env.Message ?? 'IsSuccess=false'}`);
      return env.Data;
    }
  }

  async listAll<T>(path: string): Promise<T[]> {
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const data = await this.get<Page<T> | T[]>(path, { page, pageSize: PAGE_SIZE });
      if (Array.isArray(data)) return data; // niektoré číselníky nestránkujú
      all.push(...data.Items);
      process.stdout.write(`\r  ${path}: ${all.length}/${data.TotalItems}`);
      if (page >= data.TotalPages || data.Items.length === 0) break;
    }
    process.stdout.write('\n');
    return all;
  }
}

const exists = (p: string) => access(p).then(() => true, () => false);

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function downloadPdfs(api: Api, outDir: string, kind: 'IssuedInvoice' | 'CreditNote', docs: Doc[]) {
  const dir = join(outDir, 'pdf');
  await mkdir(dir, { recursive: true });
  const prefix = kind === 'IssuedInvoice' ? 'faktura' : 'dobropis';
  const failed: string[] = [];
  let done = 0;
  for (const d of docs) {
    const file = join(dir, `${prefix}-${safeName(d.DocumentNumber ?? 'bez-cisla')}-${d.Id}.pdf`);
    done++;
    if (await exists(file)) continue;
    process.stdout.write(`\r  PDF ${kind}: ${done}/${docs.length}`);
    try {
      const b64 = await api.get<string>(`/Reports/${kind}/${d.Id}/Pdf`, { compressed: 'false' });
      const buf = Buffer.from(b64, 'base64');
      if (buf.subarray(0, 4).toString('latin1') !== '%PDF') {
        await writeFile(file.replace(/\.pdf$/, '.unknown.b64'), b64);
        failed.push(`${d.DocumentNumber} (neočakávaný formát, uložené ako .b64)`);
        continue;
      }
      await writeFile(file, buf);
    } catch (e) {
      failed.push(`${d.DocumentNumber}: ${(e as Error).message}`);
    }
  }
  process.stdout.write(`\r  PDF ${kind}: ${docs.length}/${docs.length}\n`);
  return failed;
}

function summarize(docs: Doc[], currencies: { Id: number; Code?: string }[]) {
  const code = new Map(currencies.map((c) => [c.Id, c.Code ?? String(c.Id)]));
  const out: Record<string, { count: number; total: number }> = {};
  for (const d of docs) {
    const key = `${d.DateOfIssue?.slice(0, 4) ?? '?'} ${code.get(d.CurrencyId ?? -1) ?? d.CurrencyId}`;
    const b = (out[key] ??= { count: 0, total: 0 });
    b.count++;
    b.total = Math.round((b.total + (d.Prices?.TotalWithVat ?? 0)) * 100) / 100;
  }
  return out;
}

async function main() {
  loadEnv();
  const outDir = resolve(process.env.IDOKLAD_OUT_DIR ?? 'idoklad');
  const rawDir = join(outDir, 'raw');
  await mkdir(rawDir, { recursive: true });

  console.log('Prihlasujem sa do iDoklad API…');
  const api = new Api(await getToken());
  const save = (name: string, data: unknown) =>
    writeFile(join(rawDir, `${name}.json`), JSON.stringify(data, null, 2));

  console.log('Sťahujem dáta:');
  const invoices = await api.listAll<Doc>('/IssuedInvoices');
  await save('issued-invoices', invoices);
  const creditNotes = await api.listAll<Doc>('/CreditNotes');
  await save('credit-notes', creditNotes);
  await save('contacts', await api.listAll('/Contacts'));

  console.log('Sťahujem číselníky:');
  const lookups: Record<string, unknown[]> = {};
  for (const [name, path] of [
    ['currencies', '/Currencies'], ['countries', '/Countries'], ['vat-rates', '/VatRates'],
    ['payment-options', '/PaymentOptions'], ['constant-symbols', '/ConstantSymbols'],
  ] as const) {
    try {
      lookups[name] = await api.listAll(path);
      await save(name, lookups[name]);
    } catch (e) {
      console.warn(`  ${path} sa nepodarilo stiahnuť (nevadí, import si poradí): ${(e as Error).message}`);
    }
  }

  console.log('Sťahujem PDF originály:');
  const failed = [
    ...(await downloadPdfs(api, outDir, 'IssuedInvoice', invoices)),
    ...(await downloadPdfs(api, outDir, 'CreditNote', creditNotes)),
  ];

  const currencies = (lookups.currencies ?? []) as { Id: number; Code?: string }[];
  const manifest = {
    fetchedAt: new Date().toISOString(),
    counts: { issuedInvoices: invoices.length, creditNotes: creditNotes.length },
    invoiceTotalsByYearCurrency: summarize(invoices, currencies),
    creditNoteTotalsByYearCurrency: summarize(creditNotes, currencies),
    pdfFailures: failed,
  };
  await writeFile(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  console.log(`\nHotovo → ${outDir}`);
  console.log(`  faktúr: ${invoices.length}, dobropisov: ${creditNotes.length}`);
  console.table(manifest.invoiceTotalsByYearCurrency);
  if (failed.length) {
    console.warn(`\n${failed.length} PDF sa nepodarilo stiahnuť (spusti skript znova, stiahnuté preskočí):`);
    for (const f of failed) console.warn(`  - ${f}`);
    process.exitCode = 2;
  }
}

main().catch((e) => {
  console.error(`\nChyba: ${(e as Error).message}`);
  process.exit(1);
});
