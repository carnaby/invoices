import type { invoiceItems, invoices, settings } from '@invoices/db';
import { calcItemTotals, type InvoiceTotals } from '@invoices/shared';

export type InvoiceRow = typeof invoices.$inferSelect;
export type ItemRow = typeof invoiceItems.$inferSelect;
export type SettingsRow = typeof settings.$inferSelect | undefined;

export interface InvoicePdfData {
  invoice: InvoiceRow;
  items: ItemRow[];
  totals: InvoiceTotals;
  settings: SettingsRow;
  qrDataUrl: string | null;
  signatureDataUrl: string | null;
}

/** Escape user-supplied strings before interpolating them into HTML. */
function esc(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const numberFmt = new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** sk-SK formatting with NBSP thousands separator normalized to a regular space. */
function fmt(n: number): string {
  return numberFmt.format(n).replace(/ /g, ' ');
}

/** '2026-01-10' -> '10. 1. 2026' (no leading zeros, no timezone conversion). */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((part) => Number(part));
  return `${d}. ${m}. ${y}`;
}

/** 'SK3112000000198742637541' -> 'SK31 1200 0000 1987 4263 7541' */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})/g, '$1 ').trim();
}

function addressLines(street?: string | null, zip?: string | null, city?: string | null, country?: string | null): string {
  const cityLine = [zip, city].filter(Boolean).map(esc).join(' ');
  const lines = [street ? esc(street) : '', cityLine, country ? esc(country) : ''].filter(Boolean);
  return lines.map((l) => `<div>${l}</div>`).join('');
}

function idLine(ico?: string | null, dic?: string | null, icDph?: string | null): string {
  const parts: string[] = [];
  if (ico) parts.push(`IČO: ${esc(ico)}`);
  if (dic) parts.push(`DIČ: ${esc(dic)}`);
  if (icDph) parts.push(`IČ DPH: ${esc(icDph)}`);
  return parts.length ? `<div class="id-line">${parts.join(' &nbsp;·&nbsp; ')}</div>` : '';
}

export function renderInvoiceHtml(data: InvoicePdfData): string {
  const { invoice, items, totals, settings, qrDataUrl, signatureDataUrl } = data;
  const currency = esc(invoice.currency);

  const contactLine = [settings?.supplierEmail, settings?.supplierPhone].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ');

  const itemRows = items
    .map((item) => {
      const t = calcItemTotals({ quantity: item.quantity, unitPrice: item.unitPrice, vatRate: item.vatRate });
      return `
        <tr>
          <td>${esc(item.description)}</td>
          <td class="num">${fmt(item.quantity)}</td>
          <td class="num">${esc(item.unit)}</td>
          <td class="num">${fmt(item.unitPrice)}</td>
          <td class="num">${fmt(item.vatRate)} %</td>
          <td class="num">${fmt(t.base)}</td>
          <td class="num">${fmt(t.vat)}</td>
          <td class="num">${fmt(t.total)}</td>
        </tr>`;
    })
    .join('');

  const vatSummaryRows = totals.vatSummary
    .map(
      (row) => `
        <tr>
          <td>${fmt(row.vatRate)} %</td>
          <td class="num">${fmt(row.base)}</td>
          <td class="num">${fmt(row.vat)}</td>
          <td class="num">${fmt(row.total)}</td>
        </tr>`,
    )
    .join('');

  const qrBlock = qrDataUrl
    ? `
      <div class="qr-block">
        <img class="qr-img" src="${esc(qrDataUrl)}" alt="PAY by square QR" />
        <div class="qr-caption">PAY by square</div>
      </div>`
    : '<div class="qr-block"></div>';

  const signatureBlock = signatureDataUrl
    ? `<div class="signature"><img src="${esc(signatureDataUrl)}" alt="Podpis" /></div>`
    : '';

  const bankColumn = settings?.iban
    ? `
      <div class="info-col">
        <div class="info-title">Bankový účet</div>
        <div>${esc(formatIban(settings.iban))}</div>
        ${settings.swift ? `<div>SWIFT/BIC: ${esc(settings.swift)}</div>` : ''}
      </div>`
    : '<div class="info-col"></div>';

  const symbolsColumn = `
      <div class="info-col">
        <div class="info-title">Symboly</div>
        ${invoice.variableSymbol ? `<div>Variabilný symbol: ${esc(invoice.variableSymbol)}</div>` : ''}
        ${invoice.constantSymbol ? `<div>Konštantný symbol: ${esc(invoice.constantSymbol)}</div>` : ''}
      </div>`;

  const datesColumn = `
      <div class="info-col">
        <div class="info-title">Dátumy</div>
        <div>Vystavenia: ${esc(formatDate(invoice.issueDate))}</div>
        <div>Splatnosti: ${esc(formatDate(invoice.dueDate))}</div>
        <div>Dodania: ${esc(formatDate(invoice.deliveryDate))}</div>
      </div>`;

  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8" />
<title>Faktúra ${esc(invoice.number)}</title>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 15mm;
    font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1d1d1f;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12mm;
    margin-bottom: 8mm;
  }
  .party { flex: 1; }
  .party .name { font-weight: 700; font-size: 11pt; margin-bottom: 2mm; }
  .party .id-line { margin-top: 1mm; color: #3a3a3c; }
  .header-right { flex: 1; text-align: right; }
  .doc-title { font-size: 14pt; font-weight: 700; margin: 0 0 2mm; }
  .doc-number { font-size: 18pt; font-weight: 700; margin-bottom: 6mm; }
  .customer-block { text-align: right; }
  .customer-block .label { color: #6e6e73; font-size: 9pt; margin-bottom: 1mm; }

  .info-band {
    display: flex;
    background: #f5f5f7;
    border-radius: 12px;
    padding: 5mm 6mm;
    margin-bottom: 6mm;
    gap: 8mm;
  }
  .info-col { flex: 1; }
  .info-title { font-weight: 700; margin-bottom: 1.5mm; }

  .intro { margin-bottom: 4mm; }
  .note { margin-top: 4mm; color: #3a3a3c; }

  table.items { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
  table.items th, table.items td { padding: 2mm 2mm; text-align: left; }
  table.items thead th { border-bottom: 2px solid #1d1d1f; font-weight: 700; }
  table.items tbody tr td { border-bottom: 1px solid #d2d2d7; }
  table.items td.num, table.items th.num { text-align: right; white-space: nowrap; }

  .bottom-row { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 6mm; gap: 10mm; }
  .qr-block { flex: 0 0 auto; text-align: center; width: 38mm; }
  .qr-img { width: 38mm; height: 38mm; }
  .qr-caption { margin-top: 1mm; font-size: 9pt; color: #6e6e73; }

  .summary { flex: 1; max-width: 90mm; }
  table.vat-summary { width: 100%; border-collapse: collapse; margin-bottom: 3mm; }
  table.vat-summary th, table.vat-summary td { padding: 1.5mm 2mm; text-align: left; }
  table.vat-summary thead th { border-bottom: 2px solid #1d1d1f; font-weight: 700; }
  table.vat-summary td.num, table.vat-summary th.num { text-align: right; white-space: nowrap; }

  .grand-total { font-size: 13pt; font-weight: 700; text-align: right; margin-top: 2mm; }

  .signature { text-align: right; margin-top: 6mm; }
  .signature img { max-height: 25mm; }

  .footer { margin-top: 12mm; padding-top: 4mm; border-top: 1px solid #d2d2d7; font-size: 8pt; color: #6e6e73; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div class="party">
      <div class="label" style="color:#6e6e73;font-size:9pt;margin-bottom:1mm;">Dodávateľ</div>
      <div class="name">${esc(settings?.supplierName)}</div>
      ${addressLines(settings?.supplierStreet, settings?.supplierZip, settings?.supplierCity, settings?.supplierCountry)}
      ${idLine(settings?.supplierIco, settings?.supplierDic, settings?.supplierIcDph)}
      ${contactLine ? `<div class="id-line">${contactLine}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="doc-title">Faktúra &mdash; daňový doklad</div>
      <div class="doc-number">${esc(invoice.number)}</div>
      <div class="customer-block">
        <div class="label">Odberateľ</div>
        <div class="name">${esc(invoice.customerName)}</div>
        ${addressLines(invoice.customerStreet, invoice.customerZip, invoice.customerCity, invoice.customerCountry)}
        ${idLine(invoice.customerIco, invoice.customerDic, invoice.customerIcDph)}
      </div>
    </div>
  </div>

  <div class="info-band">
    ${bankColumn}
    ${symbolsColumn}
    ${datesColumn}
  </div>

  ${invoice.introText ? `<p class="intro">${esc(invoice.introText)}</p>` : ''}

  <table class="items">
    <thead>
      <tr>
        <th>Označenie dodávky</th>
        <th class="num">Počet</th>
        <th class="num">m. j.</th>
        <th class="num">Cena za m. j.</th>
        <th class="num">DPH %</th>
        <th class="num">Bez DPH</th>
        <th class="num">DPH</th>
        <th class="num">Spolu</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  ${invoice.note ? `<p class="note">${esc(invoice.note)}</p>` : ''}

  <div class="bottom-row">
    ${qrBlock}
    <div class="summary">
      <table class="vat-summary">
        <thead>
          <tr>
            <th>Sadzba DPH</th>
            <th class="num">Základ</th>
            <th class="num">Výška DPH</th>
            <th class="num">Spolu</th>
          </tr>
        </thead>
        <tbody>
          ${vatSummaryRows}
        </tbody>
      </table>
      <div class="grand-total">Spolu na úhradu: ${fmt(totals.total)} ${currency}</div>
      ${signatureBlock}
    </div>
  </div>

  ${settings?.registrationText ? `<div class="footer">${esc(settings.registrationText)}</div>` : ''}
</body>
</html>`;
}
