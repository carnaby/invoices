# Invoices

Jednoduchá fakturačná aplikácia pre malé firmy a živnostníkov — správa kontaktov, tvorba faktúr, generovanie PDF (vrátane QR platby Pay by Square) a odosielanie e-mailom, s webovým rozhraním a API postaveným na modernom TypeScript stacku.

## Stack

- **API**: NestJS + tRPC (Express adapter), Drizzle ORM, PostgreSQL, Puppeteer (generovanie PDF), argon2 (heslá)
- **Web**: Next.js 15 (App Router, `output: standalone`), React 19, TanStack Query, tRPC client
- **Zdieľané balíky**: `libs/shared` (Zod schémy, typy), `libs/db` (Drizzle schéma, migrácie, DB klient)
- **Monorepo**: pnpm workspaces + Nx
- **Testy**: Vitest (unit/integration), Playwright (e2e)

## Požiadavky

- Node.js 22+
- pnpm 9/10 (spravované cez `corepack`)
- Docker + Docker Compose (lokálna databáza aj produkčné nasadenie)

## Vývoj

```bash
cp .env.example .env
pnpm install
pnpm db:up                              # spustí lokálnu Postgres (dev + test) v Dockeri
pnpm --filter @invoices/db migrate:dev  # aplikuje DB migrácie
pnpm --filter @invoices/api dev         # API na http://localhost:3333
pnpm --filter @invoices/web dev         # Web na http://localhost:3000
```

Databázy pre vývoj a testy bežia v kontajneroch definovaných v `docker/docker-compose.yml` (spúšťa/zastavuje sa cez `pnpm db:up` / `pnpm db:down`).

## Testy

```bash
pnpm test
```

Spustí unit a integračné testy (Vitest) vo všetkých balíkoch cez Nx. Web aplikácia má navyše end-to-end testy (Playwright) v `apps/web/e2e` — spúšťajú sa cez `pnpm --filter @invoices/web test` a počas behu si sami naštartujú API aj web server proti samostatnej e2e databáze (port `5433`), takže netreba nič ručne pripravovať vopred okrem bežiacich Docker kontajnerov (`pnpm db:up`).

## Nasadenie na NAS

Produkčný beh je pripravený ako trojica Docker kontajnerov (Postgres, API, Web) cez `docker/docker-compose.prod.yml`. Obrazy sa buildujú lokálne z monorepa, takže netreba samostatný registry.

```bash
cd docker
cp .env.prod.example .env
# uprav .env: silné heslo, APP_SECRET (64 hex znakov) a skutočnú IP/doménu NAS-u
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

Po naštartovaní:
- Web beží na `http://<NAS-IP>:3000`
- API beží na `http://<NAS-IP>:3333` (health check: `GET /trpc/health.ping`)
- Databázové dáta sú perzistentné v pomenovanom volume `invoices-db`
- DB migrácie sa aplikujú automaticky pri štarte API kontajnera

Pre aktualizáciu na novú verziu stačí `git pull` a znova spustiť `docker compose ... up -d --build`.

## Zálohovanie

Zálohu databázy vytvoríte skriptom `docker/backup.sh` (vyžaduje bash, napr. Git Bash na Windows) — vytvorí komprimovaný SQL dump do `backups/invoices-<timestamp>.sql.gz`:

```bash
./docker/backup.sh docker-compose.prod.yml
```

Obnova zo zálohy:

```bash
./docker/restore.sh ../backups/invoices-<timestamp>.sql.gz docker-compose.prod.yml
```

Pre automatické pravidelné zálohy pridajte na NAS-e (alebo inom Linux hostiteľovi) cron záznam, napríklad denne o 3:00 ráno:

```
0 3 * * * /path/to/invoices/docker/backup.sh docker-compose.prod.yml
```

Na Windows počas vývoja je k dispozícii `docker/backup.ps1`, ktorý zálohuje lokálnu vývojovú databázu (nekomprimovaný `.sql` súbor).

Priečinok `backups/` je vylúčený z gitu — zálohy si zálohujte mimo repozitára (napr. na iný disk alebo úložisko).

## Licencia

MIT
