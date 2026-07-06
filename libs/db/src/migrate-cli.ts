import { runMigrations } from './migrate';
const url = process.env.DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5432/invoices';
runMigrations(url).then(() => console.log('migrated'));
