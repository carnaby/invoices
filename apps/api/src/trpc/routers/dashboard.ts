import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { invoiceItems, invoices } from '@invoices/db';
import { derivePaymentStatus, isOverdue, round2 } from '@invoices/shared';
import { authedProcedure, router } from '../trpc';
import { todayIso } from '../../invoices/invoices.service';

const totalExpr = sql<string>`coalesce(sum(
  round(${invoiceItems.quantity} * ${invoiceItems.unitPrice}, 2)
  + round(round(${invoiceItems.quantity} * ${invoiceItems.unitPrice}, 2) * ${invoiceItems.vatRate} / 100, 2)
), 0)`;

export const dashboardRouter = router({
  stats: authedProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const yearRowsQ = ctx.db
        .select({ year: sql<number>`distinct extract(year from ${invoices.issueDate})::int` })
        .from(invoices)
        .where(eq(invoices.userId, ctx.userId));

      const rowsQ = ctx.db
        .select({ invoice: invoices, total: totalExpr })
        .from(invoices)
        .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
        .where(and(eq(invoices.userId, ctx.userId), sql`extract(year from ${invoices.issueDate}) = ${input.year}`))
        .groupBy(invoices.id);

      const recentQ = ctx.db
        .select({ invoice: invoices, total: totalExpr })
        .from(invoices)
        .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
        .where(eq(invoices.userId, ctx.userId))
        .groupBy(invoices.id)
        .orderBy(desc(invoices.issueDate), desc(invoices.number))
        .limit(5);

      const [yearRows, rows, recentRows] = await Promise.all([yearRowsQ, rowsQ, recentQ]);

      const today = todayIso();
      type Bucket = {
        count: number; invoicedTotal: number; paidTotal: number; unpaidTotal: number;
        overdueTotal: number; overdueCount: number; monthly: number[];
      };
      const byCurrencyMap = new Map<string, Bucket>();
      for (const { invoice, total } of rows) {
        const t = Number(total);
        const bucket = byCurrencyMap.get(invoice.currency) ?? {
          count: 0, invoicedTotal: 0, paidTotal: 0, unpaidTotal: 0,
          overdueTotal: 0, overdueCount: 0, monthly: Array(12).fill(0) as number[],
        };
        bucket.count += 1;
        bucket.invoicedTotal = round2(bucket.invoicedTotal + t);
        const month = Number(invoice.issueDate.slice(5, 7)) - 1;
        bucket.monthly[month] = round2(bucket.monthly[month] + t);
        const paid = Math.min(invoice.paidAmount, t);
        bucket.paidTotal = round2(bucket.paidTotal + paid);
        const unpaid = round2(Math.max(0, t - invoice.paidAmount));
        bucket.unpaidTotal = round2(bucket.unpaidTotal + unpaid);
        const status = derivePaymentStatus(t, invoice.paidAmount);
        if (isOverdue(invoice.dueDate, status, today)) {
          bucket.overdueCount += 1;
          bucket.overdueTotal = round2(bucket.overdueTotal + unpaid);
        }
        byCurrencyMap.set(invoice.currency, bucket);
      }
      const byCurrency = [...byCurrencyMap.entries()]
        .sort(([ca, a], [cb, b]) => b.count - a.count || ca.localeCompare(cb))
        .map(([currency, b]) => ({
          currency, invoicedTotal: b.invoicedTotal, paidTotal: b.paidTotal,
          unpaidTotal: b.unpaidTotal, overdueTotal: b.overdueTotal,
          overdueCount: b.overdueCount, monthly: b.monthly,
        }));

      const recent = recentRows.map(({ invoice, total }) => {
        const t = Number(total);
        const status = derivePaymentStatus(t, invoice.paidAmount);
        return {
          id: invoice.id, number: invoice.number, customerName: invoice.customerName,
          issueDate: invoice.issueDate, dueDate: invoice.dueDate, currency: invoice.currency,
          paidAmount: invoice.paidAmount, sentAt: invoice.sentAt,
          total: t, status, overdue: isOverdue(invoice.dueDate, status, today),
        };
      });

      return { byCurrency, recent, years: yearRows.map((r) => r.year) };
    }),
});
