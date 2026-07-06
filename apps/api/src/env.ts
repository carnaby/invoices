import path from 'node:path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../../.env') });

export const env = {
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5432/invoices',
  appSecret: process.env.APP_SECRET ?? 'dev-secret-do-not-use-in-prod-0000000000000000',
  apiPort: Number(process.env.API_PORT ?? 3333),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:3000',
};
