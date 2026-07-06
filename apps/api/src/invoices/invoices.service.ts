import { TRPCError } from '@trpc/server';
import { and, asc, eq } from 'drizzle-orm';
import { invoiceItems, invoices, type Db } from '@invoices/db';
import { calcInvoiceTotals, type InvoiceTotals } from '@invoices/shared';

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const invoiceNotFound = () => new TRPCError({ code: 'NOT_FOUND', message: 'Faktúra neexistuje' });

export async function loadInvoiceWithItems(db: Db, userId: string, id: string) {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  if (!invoice) throw invoiceNotFound();
  const items = await db
    .select()
    .from(invoiceItems)
    .where(eq(invoiceItems.invoiceId, id))
    .orderBy(asc(invoiceItems.position));
  const totals: InvoiceTotals = calcInvoiceTotals(items);
  return { invoice, items, totals };
}
