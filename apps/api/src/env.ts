import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });

const isProduction = process.env.NODE_ENV === 'production';
const appSecret = process.env.APP_SECRET;

// In production a missing/weak APP_SECRET would silently fall back to the
// hardcoded dev secret below, which is publicly known and used to encrypt
// SMTP credentials — fail loudly instead of booting insecurely.
if (isProduction && (!appSecret || appSecret.length < 32)) {
  console.error(
    'CHYBA: Premenná prostredia APP_SECRET musí byť v produkcii nastavená a mať aspoň 32 znakov. Server sa nespustí.',
  );
  process.exit(1);
}

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5432/invoices',
  appSecret: appSecret ?? 'dev-secret-do-not-use-in-prod-0000000000000000',
  apiPort: Number(process.env.API_PORT ?? 3333),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
};
