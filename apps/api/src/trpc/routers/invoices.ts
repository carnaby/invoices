import { TRPCError } from '@trpc/server';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { invoiceItems, invoices } from '@invoices/db';
import {
  calcInvoiceTotals, derivePaymentStatus, invoiceInputSchema, isOverdue,
  markPaidSchema, suggestInvoiceNumber, type InvoiceInput,
} from '@invoices/shared';
import { authedProcedure, router } from '../trpc';
import { invoiceNotFound, loadInvoiceWithItems, todayIso } from '../../invoices/invoices.service';

const idInput = z.object({ id: z.string().uuid() });

function invoiceValues(userId: string, data: InvoiceInput) {
  const { items, ...invoice } = data;
  const variableSymbol =
    invoice.variableSymbol || (/^\d+$/.test(invoice.number) ? invoice.number : null);
  return { invoice: { ...invoice, variableSymbol, userId }, items };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e != null && 'cause' in e
    ? (e as any).cause?.code === '23505' || (e as any).code === '23505'
    : (e as any)?.code === '23505';
}

const conflict = () =>
  new TRPCError({ code: 'CONFLICT', message: 'Faktúra s týmto číslom už existuje' });

export const invoicesRouter = router({
  suggestNumber: authedProcedure
    .input(z.object({ year: z.number().int().min(2000).max(2100) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ number: invoices.number })
        .from(invoices)
        .where(eq(invoices.userId, ctx.userId));
      return { number: suggestInvoiceNumber(input.year, rows.map((r) => r.number)) };
    }),

  create: authedProcedure.input(invoiceInputSchema).mutation(async ({ ctx, input }) => {
    const { invoice, items } = invoiceValues(ctx.userId, input);
    try {
      return await ctx.db.transaction(async (tx) => {
        const [created] = await tx.insert(invoices).values(invoice).returning({ id: invoices.id });
        await tx.insert(invoiceItems).values(
          items.map((item, i) => ({ ...item, invoiceId: created.id, position: i + 1 })),
        );
        return { id: created.id };
      });
    } catch (e) {
      if (isUniqueViolation(e)) throw conflict();
      throw e;
    }
  }),

  update: authedProcedure
    .input(z.object({ id: z.string().uuid(), data: invoiceInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const { invoice, items } = invoiceValues(ctx.userId, input.data);
      try {
        return await ctx.db.transaction(async (tx) => {
          const [updated] = await tx
            .update(invoices)
            .set({ ...invoice, updatedAt: new Date() })
            .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.userId)))
            .returning({ id: invoices.id });
          if (!updated) throw invoiceNotFound();
          await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
          await tx.insert(invoiceItems).values(
            items.map((item, i) => ({ ...item, invoiceId: input.id, position: i + 1 })),
          );
          return { id: input.id };
        });
      } catch (e) {
        if (isUniqueViolation(e)) throw conflict();
        throw e;
      }
    }),

  get: authedProcedure.input(idInput).query(({ ctx, input }) =>
    loadInvoiceWithItems(ctx.db, ctx.userId, input.id),
  ),

  list: authedProcedure
    .input(
      z.object({
        year: z.number().int().optional(),
        status: z.enum(['paid', 'partial', 'unpaid', 'overdue']).optional(),
        search: z.string().trim().optional(),
      }).default({}),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(invoices.userId, ctx.userId)];
      if (input.year) {
        conditions.push(sql`extract(year from ${invoices.issueDate}) = ${input.year}`);
      }
      if (input.search) {
        const q = `%${input.search}%`;
        conditions.push(or(ilike(invoices.number, q), ilike(invoices.customerName, q))!);
      }
      const rows = await ctx.db
        .select({
          invoice: invoices,
          total: sql<string>`coalesce(sum(
            round(${invoiceItems.quantity} * ${invoiceItems.unitPrice}, 2)
            + round(round(${invoiceItems.quantity} * ${invoiceItems.unitPrice}, 2) * ${invoiceItems.vatRate} / 100, 2)
          ), 0)`,
        })
        .from(invoices)
        .leftJoin(invoiceItems, eq(invoiceItems.invoiceId, invoices.id))
        .where(and(...conditions))
        .groupBy(invoices.id)
        .orderBy(desc(invoices.number));

      const today = todayIso();
      let list = rows.map(({ invoice, total }) => {
        const t = Number(total);
        const status = derivePaymentStatus(t, invoice.paidAmount);
        return {
          id: invoice.id, number: invoice.number, customerName: invoice.customerName,
          issueDate: invoice.issueDate, dueDate: invoice.dueDate, currency: invoice.currency,
          paidAmount: invoice.paidAmount, sentAt: invoice.sentAt,
          total: t, status, overdue: isOverdue(invoice.dueDate, status, today),
        };
      });
      if (input.status === 'overdue') list = list.filter((i) => i.overdue);
      else if (input.status) list = list.filter((i) => i.status === input.status);

      const yearRows = await ctx.db
        .select({ year: sql<number>`distinct extract(year from ${invoices.issueDate})::int` })
        .from(invoices)
        .where(eq(invoices.userId, ctx.userId));

      return {
        invoices: list,
        summary: {
          count: list.length,
          total: Math.round(list.reduce((s, i) => s + i.total, 0) * 100) / 100,
          unpaid: Math.round(list.reduce((s, i) => s + Math.max(0, i.total - i.paidAmount), 0) * 100) / 100,
        },
        years: yearRows.map((r) => r.year),
      };
    }),

  remove: authedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const deleted = await ctx.db
      .delete(invoices)
      .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.userId)))
      .returning({ id: invoices.id });
    if (deleted.length === 0) throw invoiceNotFound();
    return { ok: true };
  }),

  markPaid: authedProcedure.input(markPaidSchema).mutation(async ({ ctx, input }) => {
    const [updated] = await ctx.db
      .update(invoices)
      .set({
        paidAmount: input.paidAmount,
        paidDate: input.paidDate ?? (input.paidAmount > 0 ? todayIso() : null),
        updatedAt: new Date(),
      })
      .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.userId)))
      .returning({ id: invoices.id });
    if (!updated) throw invoiceNotFound();
    return { id: updated.id };
  }),
});
