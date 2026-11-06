import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { invoiceItems, invoiceOriginals, invoices, type Db } from '@invoices/db';
import { calcInvoiceTotals, type InvoiceTotals } from '@invoices/shared';

export { todayIso } from '@invoices/shared';

export const invoiceNotFound = () => new TRPCError({ code: 'NOT_FOUND', message: 'Faktúra neexistuje' });

export const invoiceLocked = () =>
  new TRPCError({ code: 'FORBIDDEN', message: 'Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.' });

export async function loadInvoiceWithItems(db: Db, userId: string, id: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      hasOriginal: sql<boolean>`exists (select 1 from ${invoiceOriginals} where ${invoiceOriginals.invoiceId} = ${invoices.id})`,
    })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  if (!row) throw invoiceNotFound();
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.position));
  const totals: InvoiceTotals = calcInvoiceTotals(items);
  return { invoice: row.invoice, items, totals, locked: row.invoice.lockedAt !== null, hasOriginal: row.hasOriginal };
}

/** Called when a write guarded by `locked_at is null` matched no row: tells "missing" from "locked". */
export async function throwMissingOrLocked(db: Db, userId: string, id: string): Promise<never> {
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  throw row ? invoiceLocked() : invoiceNotFound();
}

export async function loadOriginal(db: Db, userId: string, invoiceId: string) {
  const [row] = await db
    .select({ pdf: invoiceOriginals.pdf, fileName: invoiceOriginals.fileName, number: invoices.number })
    .from(invoiceOriginals)
    .innerJoin(invoices, eq(invoices.id, invoiceOriginals.invoiceId))
    .where(and(eq(invoiceOriginals.invoiceId, invoiceId), eq(invoices.userId, userId)));
  return row ?? null;
}
