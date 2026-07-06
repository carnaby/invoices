import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { sessions, settings, users, type Db } from '@invoices/db';
import type { ChangePasswordInput, LoginInput, RegisterInput } from '@invoices/shared';
import { hashToken, SESSION_TTL_DAYS } from '../trpc/context';

export async function registerUser(db: Db, input: RegisterInput) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, input.username));
  if (existing) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Používateľ s týmto menom už existuje' });
  }
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  const [user] = await db.insert(users).values({ username: input.username, passwordHash }).returning();
  await db.insert(settings).values({ userId: user.id });
  return { id: user.id, username: user.username };
}

export async function verifyCredentials(db: Db, input: LoginInput) {
  const [user] = await db.select().from(users).where(eq(users.username, input.username));
  const invalid = new TRPCError({ code: 'UNAUTHORIZED', message: 'Nesprávne meno alebo heslo' });
  if (!user) throw invalid;
  const ok = await argon2.verify(user.passwordHash, input.password);
  if (!ok) throw invalid;
  return { id: user.id, username: user.username };
}

export async function createSession(db: Db, userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  return token;
}

export async function destroySession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export async function changeUserPassword(
  db: Db,
  userId: string,
  currentToken: string | undefined,
  input: ChangePasswordInput,
): Promise<{ ok: true }> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const ok = user ? await argon2.verify(user.passwordHash, input.currentPassword) : false;
  if (!ok) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Nesprávne aktuálne heslo' });
  }
  const passwordHash = await argon2.hash(input.newPassword, { type: argon2.argon2id });
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));

  const currentTokenHash = currentToken ? hashToken(currentToken) : null;
  await db
    .delete(sessions)
    .where(
      currentTokenHash
        ? and(eq(sessions.userId, userId), ne(sessions.tokenHash, currentTokenHash))
        : eq(sessions.userId, userId),
    );

  return { ok: true };
}
