import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });
  return Object.assign(db, { $pool: pool });
}
export type Db = ReturnType<typeof createDb>;
/** The handle a `db.transaction` callback receives. */
export type DbTx = Parameters<Parameters<Db['transaction']>[0]>[0];
