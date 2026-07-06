import { TRPCError } from '@trpc/server';
import { and, asc, eq, ilike, isNull, or } from 'drizzle-orm';
import { z } from 'zod';
import { contacts } from '@invoices/db';
import { contactInputSchema } from '@invoices/shared';
import { authedProcedure, router } from '../trpc';

const notFound = () => new TRPCError({ code: 'NOT_FOUND', message: 'Kontakt neexistuje' });
const idInput = z.object({ id: z.string().uuid() });

export const contactsRouter = router({
  list: authedProcedure
    .input(z.object({ search: z.string().trim().optional() }).default({}))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(contacts.userId, ctx.userId), isNull(contacts.deletedAt)];
      if (input.search) {
        const q = `%${input.search}%`;
        conditions.push(or(ilike(contacts.companyName, q), ilike(contacts.ico, q), ilike(contacts.city, q))!);
      }
      return ctx.db.select().from(contacts).where(and(...conditions)).orderBy(asc(contacts.companyName));
    }),

  get: authedProcedure.input(idInput).query(async ({ ctx, input }) => {
    const [c] = await ctx.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.userId), isNull(contacts.deletedAt)));
    if (!c) throw notFound();
    return c;
  }),

  create: authedProcedure.input(contactInputSchema).mutation(async ({ ctx, input }) => {
    const [c] = await ctx.db.insert(contacts).values({ ...input, userId: ctx.userId }).returning();
    return c;
  }),

  update: authedProcedure
    .input(z.object({ id: z.string().uuid(), data: contactInputSchema }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db
        .update(contacts)
        .set({ ...input.data, updatedAt: new Date() })
        .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.userId), isNull(contacts.deletedAt)))
        .returning();
      if (!c) throw notFound();
      return c;
    }),

  remove: authedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
    const [c] = await ctx.db
      .update(contacts)
      .set({ deletedAt: new Date() })
      .where(and(eq(contacts.id, input.id), eq(contacts.userId, ctx.userId), isNull(contacts.deletedAt)))
      .returning();
    if (!c) throw notFound();
    return { ok: true };
  }),
});
