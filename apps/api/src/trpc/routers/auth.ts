import { eq } from 'drizzle-orm';
import { users } from '@invoices/db';
import { loginSchema, registerSchema } from '@invoices/shared';
import { publicProcedure, router } from '../trpc';
import { createSession, destroySession, registerUser, verifyCredentials } from '../../auth/auth.service';

export const authRouter = router({
  register: publicProcedure.input(registerSchema).mutation(async ({ ctx, input }) => {
    const user = await registerUser(ctx.db, input);
    ctx.setSessionCookie(await createSession(ctx.db, user.id));
    return user;
  }),
  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const user = await verifyCredentials(ctx.db, input);
    ctx.setSessionCookie(await createSession(ctx.db, user.id));
    return user;
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    const token = ctx.getSessionToken();
    if (token) await destroySession(ctx.db, token);
    ctx.setSessionCookie(null);
    return { ok: true };
  }),
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) return null;
    const [u] = await ctx.db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(eq(users.id, ctx.userId));
    return u ?? null;
  }),
});
