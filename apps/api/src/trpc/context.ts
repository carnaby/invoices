import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { sessions, type Db } from '@invoices/db';

export interface TrpcContext {
  db: Db;
  userId: string | null;
  /** Visitor IP (from X-Forwarded-For via Express `trust proxy`, see main.ts). */
  clientIp: string;
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

/** `Secure` in production: the cookie never goes over plain http (e.g. the first request before Caddy's redirect). */
function cookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, path: '/', secure: process.env.NODE_ENV === 'production' };
}

export function createContextFactory(db: Db) {
  return async ({ req, res }: { req: Request; res: Response }): Promise<TrpcContext> => {
    const token = (req.cookies?.[SESSION_COOKIE] as string | undefined) ?? undefined;
    const userId = await resolveUserId(db, token);
    return {
      db,
      userId,
      clientIp: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      getSessionToken: () => token,
      setSessionCookie: (newToken) => {
        if (newToken === null) {
          res.clearCookie(SESSION_COOKIE, cookieOptions());
        } else {
          res.cookie(SESSION_COOKIE, newToken, {
            ...cookieOptions(),
            maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
          });
        }
      },
    };
  };
}

/** In-memory context for integration tests — captures the cookie instead of HTTP. */
export function createTestContext(db: Db, userId: string | null = null, clientIp = '127.0.0.1') {
  const ctx = {
    db,
    userId,
    clientIp,
    cookieJar: {} as { token?: string },
    getSessionToken: (): string | undefined => ctx.cookieJar.token,
    setSessionCookie: (t: string | null) => {
      if (t === null) delete ctx.cookieJar.token;
      else ctx.cookieJar.token = t;
    },
  };
  return ctx;
}
