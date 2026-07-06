import { router } from './trpc';
import { healthRouter } from './routers/health';
import { authRouter } from './routers/auth';
import type { TrpcContext } from './context';

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
});
export type AppRouter = typeof appRouter;

export function createCaller(ctx: TrpcContext) {
  return appRouter.createCaller(ctx);
}
