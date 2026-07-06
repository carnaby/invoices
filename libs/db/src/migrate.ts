import { migrate } from 'drizzle-orm/node-postgres/migrator';
import path from 'node:path';
import { createDb } from './client';

export async function runMigrations(connectionString: string) {
  const db = createDb(connectionString);
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'migrations') });
  await db.$pool.end();
}
