import { TRPCError } from '@trpc/server';
import { and, asc, eq, sql } from 'drizzle-orm';
import { invoiceItems, invoiceOriginals, invoicePayments, invoices, type Db, type DbTx } from '@invoices/db';
import { calcInvoiceTotals, formatMoney, round2, type InvoiceTotals } from '@invoices/shared';

export { todayIso } from '@invoices/shared';

export const invoiceNotFound = () => new TRPCError({ code: 'NOT_FOUND', message: 'Faktúra neexistuje' });

export type LockReason = 'idoklad' | 'paid';

// Correlated subqueries on the current `invoices` row. The names are written out qualified on purpose:
// in a single-table select Drizzle renders columns unqualified, and "invoice_id" = "id" would then
// compare a payment with itself.
/** Paid amount of the invoice in the current row: the sum of its payments (numeric comes back as a string). */
export const paidAmountSql = sql<string>`coalesce((select sum(p.amount) from invoice_payments p where p.invoice_id = "invoices"."id"), 0)`;
/** Date of the latest payment of the invoice in the current row, or null. */
export const paidDateSql = sql<string | null>`(select max(p.paid_on) from invoice_payments p where p.invoice_id = "invoices"."id")`;

// Rounds like the stored value (round2, half away from zero) so 1.005 is checked as 1.01, as it will be saved.
const toCents = (n: number) => Math.round(round2(n) * 100);
const formatCents = (cents: number, currency: string) => formatMoney(Math.max(0, cents) / 100, currency);

/** Imported invoices stay locked; any other invoice locks once it is fully paid (a zero total never locks). */
export function lockReasonOf(lockedAt: Date | null, total: number, paidAmount: number): LockReason | null {
  if (lockedAt) return 'idoklad';
  if (toCents(total) > 0 && toCents(paidAmount) >= toCents(total)) return 'paid';
  return null;
}

export const invoiceLocked = (reason: LockReason) =>
  new TRPCError({
    code: 'FORBIDDEN',
    message:
      reason === 'idoklad'
        ? 'Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.'
        : 'Uhradená faktúra je uzamknutá a nedá sa meniť ani zmazať.',
  });

export async function loadInvoiceWithItems(db: Db, userId: string, id: string) {
  const [row] = await db
    .select({
      invoice: invoices,
      paidAmount: paidAmountSql,
      paidDate: paidDateSql,
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
  const payments = await db
    .select({ id: invoicePayments.id, paidOn: invoicePayments.paidOn, amount: invoicePayments.amount })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, id))
    .orderBy(asc(invoicePayments.paidOn), asc(invoicePayments.createdAt));
  const invoice = { ...row.invoice, paidAmount: Number(row.paidAmount), paidDate: row.paidDate };
  const totals: InvoiceTotals = calcInvoiceTotals(items);
  const lockReason = lockReasonOf(invoice.lockedAt, totals.total, invoice.paidAmount);
  return { invoice, items, payments, totals, locked: lockReason !== null, lockReason, hasOriginal: row.hasOriginal };
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

/**
 * Locks the invoice row for the rest of the transaction and returns its paid amount and current total,
 * so payments and edits recorded at once are checked one after the other.
 */
export async function lockInvoiceRow(tx: DbTx, userId: string, id: string) {
  const [invoice] = await tx
    .select({ currency: invoices.currency, lockedAt: invoices.lockedAt })
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)))
    .for('update');
  if (!invoice) throw invoiceNotFound();
  // Read after the row lock, so a payment added or deleted at the same time is already counted.
  const [paid] = await tx
    .select({ amount: sql<string>`coalesce(sum(${invoicePayments.amount}), 0)` })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, id));
  const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  return { ...invoice, paidAmount: Number(paid.amount), total: calcInvoiceTotals(items).total };
}

/** Refuses to edit or delete a locked invoice; the row stays locked until the transaction ends. */
export async function lockForEdit(tx: DbTx, userId: string, id: string) {
  const row = await lockInvoiceRow(tx, userId, id);
  const reason = lockReasonOf(row.lockedAt, row.total, row.paidAmount);
  if (reason) throw invoiceLocked(reason);
  return row;
}

/**
 * Refuses an edit that brought the invoice total below what is already paid. Runs after the new items
 * are written, on the stored (rounded) values; throwing rolls the edit back. Nothing paid → nothing to check,
 * so credit notes with a negative total stay editable.
 */
export async function checkStoredTotal(tx: DbTx, id: string, row: { paidAmount: number; currency: string }) {
  if (toCents(row.paidAmount) <= 0) return;
  const items = await tx.select().from(invoiceItems).where(eq(invoiceItems.invoiceId, id));
  if (toCents(calcInvoiceTotals(items).total) < toCents(row.paidAmount)) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Suma faktúry nemôže byť nižšia ako už uhradených ${formatMoney(row.paidAmount, row.currency)}.`,
    });
  }
}

/** Refuses a currency change while something is paid: the paid amount keeps no currency of its own. */
export function checkCurrencyChange(row: { paidAmount: number; currency: string }, currency: string) {
  if (toCents(row.paidAmount) !== 0 && currency !== row.currency) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Menu faktúry nemožno zmeniť, kým má zapísané úhrady. Najprv zrušte úhrady.',
    });
  }
}

/** Refuses a payment that would bring the paid amount above the invoice total. */
export async function checkAddedPayment(tx: DbTx, userId: string, id: string, amount: number) {
  const { paidAmount, total, currency } = await lockInvoiceRow(tx, userId, id);
  const remaining = toCents(total) - toCents(paidAmount);
  if (toCents(amount) > remaining) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Úhrada presahuje zostávajúcu sumu ${formatCents(remaining, currency)}.`,
    });
  }
}
