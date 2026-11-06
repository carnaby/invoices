import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { invoiceItems, invoiceOriginals, invoices, type Db, type DbTx } from '@invoices/db';
import { calcInvoiceTotals, round2, type InvoiceTotals } from '@invoices/shared';

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
export async function throwMissingOrLocked(db: Db | DbTx, userId: string, id: string): Promise<never> {
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  throw row ? invoiceLocked() : invoiceNotFound();
}

/** One query for the download: null when the invoice is missing, `pdf: null` when it has no original. */
export async function loadInvoiceOriginal(db: Db, userId: string, invoiceId: string) {
  const [row] = await db
    .select({ number: invoices.number, pdf: invoiceOriginals.pdf })
    .from(invoices)
    .leftJoin(invoiceOriginals, eq(invoiceOriginals.invoiceId, invoices.id))
    .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));
  return row ?? null;
}

export async function loadOriginal(db: Db, userId: string, invoiceId: string) {
  const [row] = await db
    .select({ pdf: invoiceOriginals.pdf, fileName: invoiceOriginals.fileName, number: invoices.number })
    .from(invoiceOriginals)
    .innerJoin(invoices, eq(invoices.id, invoiceOriginals.invoiceId))
    .where(and(eq(invoiceOriginals.invoiceId, invoiceId), eq(invoices.userId, userId)));
  return row ?? null;
}

// Rounds like the stored value (round2, half away from zero) so 1.005 is checked as 1.01, as it will be saved.
const toCents = (n: number) => Math.round(round2(n) * 100);
const formatCents = (cents: number, currency: string) =>
  `${(Math.max(0, cents) / 100).toFixed(2).replace('.', ',')} ${currency}`;

/**
 * Locks the invoice row for the rest of the transaction and returns what a payment needs,
 * so two payments recorded at once are checked one after the other.
 */
async function lockForPayment(tx: DbTx, userId: string, id: string) {
  const [invoice] = await tx
    .select({ paidAmount: invoices.paidAmount, currency: invoices.currency })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .for('update');
  if (!invoice) throw invoiceNotFound();
  const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return { ...invoice, total: calcInvoiceTotals(items).total };
}

/** Refuses a payment that would bring the paid amount above the invoice total. */
export async function checkAddedPayment(tx: DbTx, userId: string, id: string, amount: number) {
  const { paidAmount, total, currency } = await lockForPayment(tx, userId, id);
  const remaining = toCents(total) - toCents(paidAmount);
  if (toCents(amount) > remaining) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Úhrada presahuje zostávajúcu sumu ${formatCents(remaining, currency)}.`,
    });
  }
}

/** Refuses a paid amount above the invoice total. */
export async function checkPaidAmount(tx: DbTx, userId: string, id: string, paidAmount: number) {
  const { total, currency } = await lockForPayment(tx, userId, id);
  if (toCents(paidAmount) > toCents(total)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Úhrada presahuje sumu faktúry ${formatCents(toCents(total), currency)}.`,
    });
  }
}
