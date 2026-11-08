# Invoices

Jednoduchá fakturačná aplikácia pre živnostníkov a malé firmy, navrhnutá najmä pre neplatiteľa DPH (náhrada iDokladu). Webové rozhranie a API sú postavené na TypeScript stacku v jednom monorepe.

## Funkcie

- kontakty (odberatelia) a faktúry s položkami, návrh čísla faktúry, viac mien, voliteľná sadzba DPH na položke
- PDF faktúry (Puppeteer) s QR platbou Pay by Square a voliteľným podpisom
- odoslanie faktúry e-mailom cez vlastný SMTP server (heslo je v databáze šifrované cez `APP_SECRET`)
- úhrady: čiastočné aj celé; úhrada nesmie presiahnuť sumu faktúry
- zámok: uhradenú faktúru nemožno upraviť ani zmazať (odomkne ju „Zrušiť úhrady“); faktúra prenesená z iDokladu s uloženým originálnym PDF je zamknutá natrvalo a originál sa dá stiahnuť a posiela sa v e-maile namiesto vygenerovaného PDF
- prehľad (dashboard)
- prihlásenie s obmedzením neúspešných pokusov (5 z jednej IP a 30 na účet za 15 minút); registrácia nových účtov je v produkcii predvolene vypnutá
- responzívne rozhranie pre mobil a inštalovateľná PWA (service worker nič necachuje, bez pripojenia ukáže iba offline stránku)

## Stack

- **API**: NestJS + tRPC (Express adapter), Drizzle ORM, PostgreSQL 16, Puppeteer (PDF), nodemailer (e-mail), argon2 (heslá)
- **Web**: Next.js 15 (App Router, `output: standalone`), React 19, TanStack Query, tRPC client, Tailwind CSS 4
- **Zdieľané balíky**: `libs/shared` (Zod schémy, typy, výpočty súm a dátumov), `libs/db` (Drizzle schéma, migrácie, DB klient)
- **Monorepo**: pnpm workspaces + Nx
- **Testy**: Vitest (unit/integračné), Playwright (e2e)

## Štruktúra

```
apps/api        NestJS + tRPC API, PDF a e-mail
apps/web        Next.js web, e2e testy v apps/web/e2e
libs/shared     zdieľané schémy a výpočty
libs/db         Drizzle schéma a migrácie
docker/         Dockerfiles, compose pre vývoj a príklad produkčného behu, skripty na zálohu
tools/idoklad   jednorazový export dát z iDokladu (pozri tools/idoklad/README.md)
```

## Požiadavky

- Node.js 22.12+
- pnpm 10 (napr. `corepack enable && corepack prepare pnpm@10 --activate`)
- Docker + Docker Compose (lokálne databázy, produkčné obrazy)

## Vývoj

```bash
cp .env.example .env
pnpm install
pnpm dev        # spustí Postgres v Dockeri (pnpm db:up), potom API a web naraz
```

- API: http://localhost:3333 (health check `GET /trpc/health.ping`)
- Web: http://localhost:3000

API pri štarte samo aplikuje DB migrácie. Ručne sa dajú spustiť cez `pnpm --filter @invoices/db migrate:dev`. Mimo produkcie je registrácia otvorená, prvý účet si založíš na `/register`.

Databázy pre vývoj (port `5432`) a testy (port `5433`) sú v `docker/docker-compose.yml` a spúšťajú sa a zastavujú cez `pnpm db:up` / `pnpm db:down`. API a web sa dajú spustiť aj samostatne: `pnpm --filter @invoices/api dev`, `pnpm --filter @invoices/web dev`.

## Konfigurácia

API číta `.env` z koreňa repa. Prehľad premenných:

| Premenná | Význam |
| --- | --- |
| `DATABASE_URL` | pripojenie k Postgres (predvolene lokálna dev DB) |
| `APP_SECRET` | šifruje SMTP heslo; v produkcii povinný, aspoň 32 znakov, inak API neštartuje. Po zmene treba SMTP heslo v appke zadať znova |
| `API_PORT` | port API (predvolene `3333`) |
| `WEB_ORIGIN` | adresa webu, povolená v CORS (predvolene `http://localhost:3000`) |
| `NEXT_PUBLIC_API_URL` | adresa API pre web; zapečie sa pri `next build` (v Dockeri build argument), predvolene `http://localhost:3333` |
| `REGISTRATION_ENABLED` | `true`/`false` prepíše predvolenú hodnotu (otvorená mimo produkcie, zatvorená pri `NODE_ENV=production`) |
| `NODE_ENV` | `production` (nastavené v obraze API) zapne `Secure` cookie a zatvorí registráciu |
| `PUPPETEER_EXECUTABLE_PATH` | voliteľne vlastný Chrome pre PDF |
| `TEST_DATABASE_URL`, `E2E_DATABASE_URL` | databázy pre Vitest a Playwright (port `5433`) |
| `IDOKLAD_*` | iba pre `pnpm idoklad:fetch` |

## Testy

```bash
pnpm test                                      # všetky balíky cez Nx: Vitest v shared, db, api + Playwright vo web
pnpm --filter @invoices/api test               # iba jeden balík
pnpm --filter @invoices/web test --workers=2   # iba e2e
pnpm --filter @invoices/api typecheck          # kontrola typov (aj @invoices/web)
```

Testy potrebujú bežiace kontajnery (`pnpm db:up`). E2E testy si samy založia databázu `invoices_e2e` na porte `5433` a naštartujú API (3333) aj web (3000), takže tieto porty musia byť voľné (vypni `pnpm dev`). Pri predvolenom počte workerov občas niektorý test vyprší pri prvej kompilácii stránky v Next dev serveri, preto `--workers=2`.

## Docker obrazy

Workflow GitHub Actions **Release images** (`.github/workflows/release.yml`) pri každom pushi do `main` zostaví a publikuje `ghcr.io/<owner>/invoices-api` a `ghcr.io/<owner>/invoices-web` (tagy `latest` a plný SHA commitu, `linux/amd64`). Push do `main` je teda nové vydanie.

Obraz API sa konfiguruje iba premennými prostredia (pozri Konfigurácia). Obraz webu má adresu API zapečenú pri builde pre autorovu inštanciu, takže pri vlastnom nasadení si web zostav sám:

```bash
docker build -f docker/web.Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://faktury.example.sk -t invoices-web .
```

### Vlastné nasadenie s Docker Compose

`docker/docker-compose.prod.yml` je príklad produkčného behu: Postgres 16, API a web zostavené lokálne z repa.

```bash
cd docker
cp .env.prod.example .env
# uprav .env: silné POSTGRES_PASSWORD, APP_SECRET (aspoň 32 znakov, napr. openssl rand -hex 32),
# WEB_ORIGIN a NEXT_PUBLIC_API_URL = https adresa, na ktorej appka pobeží
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

- Pred appku patrí reverzná proxy s HTTPS (napr. Caddy alebo nginx). V produkcii má session cookie príznak `Secure`, takže cez obyčajné `http` (okrem `localhost`) sa prihlásenie neudrží. Najjednoduchšie je jedna doména: `/trpc` a `/files` na API (port `3333`), všetko ostatné na web (port `3000`).
- Registrácia je v produkcii vypnutá. Na založenie prvého účtu dočasne pridaj do `environment` služby `api` riadok `REGISTRATION_ENABLED: 'true'`, zaregistruj sa a riadok potom odstráň.
- DB migrácie sa aplikujú automaticky pri štarte API, dáta sú v pomenovanom volume `invoices-db`.
- Aktualizácia: `git pull` a znova `docker compose ... up -d --build`.

## Zálohovanie

Skript `docker/backup.sh` (bash, na Windows napr. Git Bash) vytvorí komprimovaný SQL dump do `backups/invoices-<timestamp>.sql.gz`. Predvolene pracuje s `docker/docker-compose.prod.yml` (služba `db`):

```bash
./docker/backup.sh docker-compose.prod.yml
```

Obnova zo zálohy (cesta k súboru je relatívna k priečinku `docker/`):

```bash
./docker/restore.sh ../backups/invoices-<timestamp>.sql.gz docker-compose.prod.yml
```

Pravidelnú zálohu zabezpečí napríklad cron na hostiteľovi, denne o 3:00:

```
0 3 * * * /path/to/invoices/docker/backup.sh docker-compose.prod.yml
```

Na Windows počas vývoja je k dispozícii `docker/backup.ps1`, ktorý zálohuje lokálnu vývojovú databázu (nekomprimovaný `.sql` súbor).

Priečinok `backups/` je vylúčený z gitu. Zálohy ukladaj mimo repozitára.

## Licencia

MIT
