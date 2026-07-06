import { Client } from 'pg';

export default async function globalSetup() {
  const admin = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5433/invoices_test' });
  await admin.connect();
  const { rowCount } = await admin.query("SELECT 1 FROM pg_database WHERE datname = 'invoices_e2e'");
  if (!rowCount) await admin.query('CREATE DATABASE invoices_e2e');
  await admin.end();
}
