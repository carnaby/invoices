import { sql } from 'drizzle-orm';
import { createDb, type Db } from './client';
import { runMigrations } from './migrate';

export const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5433/invoices_test';

export async function createTestDb() {
  await runMigrations(TEST_DB_URL);
  const db = createDb(TEST_DB_URL);
  return { db, close: async () => { await db.$pool.end(); } };
}

export async function truncateAll(db: Db) {
  await db.execute(
    sql`TRUNCATE TABLE invoice_items, invoices, contacts, sessions, settings, users CASCADE`,
  );
}
