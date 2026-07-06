import { router } from './trpc';
import { healthRouter } from './routers/health';
import { authRouter } from './routers/auth';
import { settingsRouter } from './routers/settings';
import { contactsRouter } from './routers/contacts';
import { invoicesRouter } from './routers/invoices';
import { dashboardRouter } from './routers/dashboard';
import type { TrpcContext } from './context';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  settings: settingsRouter,
  contacts: contactsRouter,
  invoices: invoicesRouter,
  dashboard: dashboardRouter,
});
export type AppRouter = typeof appRouter;

export function createCaller(ctx: TrpcContext) {
  return appRouter.createCaller(ctx);
}
