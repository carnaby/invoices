import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, type Db } from '@invoices/db';

export interface TrpcContext {
  db: Db;
  userId: string | null;
  getSessionToken(): string | undefined;
  setSessionCookie(token: string | null): void;
}

export const SESSION_COOKIE = 'sid';
export const SESSION_TTL_DAYS = 30;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function resolveUserId(db: Db, token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row?.userId ?? null;
}

export function createContextFactory(db: Db) {
  return async ({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> => {
    const token = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? undefined;
    const userId = await resolveUserId(db, token);
    return {
      db,
      userId,
      getSessionToken: () => token,
      setSessionCookie: (newToken) => {
        if (newToken === null) {
          res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', path: '/' });
        } else {
          res.cookie(SESSION_COOKIE, newToken, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
          });
        }
      },
    };
  };
}

/** In-memory context for integration tests — captures the cookie instead of HTTP. */
export function createTestContext(db: Db, userId: string | null = null) {
  const ctx = {
    db,
    userId,
    cookieJar: {} as { token?: string },
    getSessionToken: (): string | undefined => ctx.cookieJar.token,
    setSessionCookie: (t: string | null) => {
      if (t === null) delete ctx.cookieJar.token;
      else ctx.cookieJar.token = t;
    },
  };
  return ctx;
}
