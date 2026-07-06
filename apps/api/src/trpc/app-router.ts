import { router } from './trpc';
import { healthRouter } from './routers/health';
import type { TrpcContext } from './context';

export const appRouter = router({
  health: healthRouter,
});
export type AppRouter = typeof appRouter;

export function createCaller(ctx: TrpcContext) {
  return appRouter.createCaller(ctx);
}
