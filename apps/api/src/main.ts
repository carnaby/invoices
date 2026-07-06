import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as trpcExpress from '@trpc/server/adapters/express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createDb, runMigrations } from '@invoices/db';
import { AppModule } from './app.module';
import { env } from './env';
import { appRouter } from './trpc/app-router';
import { createContextFactory } from './trpc/context';
import { createFilesRouter } from './rest/files';

async function bootstrap() {
  await runMigrations(env.databaseUrl);
  const db = createDb(env.databaseUrl);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.enableCors({ origin: env.webOrigin, credentials: true });
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(db),
    }),
  );
  app.use('/files', createFilesRouter(db));
  await app.listen(env.apiPort);
  console.log(`API listening on http://localhost:${env.apiPort}`);
}
bootstrap();
