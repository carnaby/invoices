import { Client } from 'pg';

const E2E_DB = process.env.E2E_DATABASE_URL ?? 'postgres://invoices:invoices@localhost:5433/invoices_e2e';

/** Makes an invoice look imported from iDoklad: stores an original PDF and locks it. */
export async function lockWithOriginal(invoiceId: string, pdf: Buffer, fileName: string) {
  const client = new Client({ connectionString: E2E_DB });
  await client.connect();
  try {
    await client.query('INSERT INTO invoice_originals (invoice_id, pdf, file_name) VALUES ($1, $2, $3)', [
      invoiceId, pdf, fileName,
    ]);
    await client.query('UPDATE invoices SET locked_at = now() WHERE id = $1', [invoiceId]);
  } finally {
    await client.end();
  }
}
