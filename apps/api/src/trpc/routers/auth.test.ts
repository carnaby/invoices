import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import { settings, users } from '@invoices/db';
import { createTestContext, resolveUserId } from '../context';
import { createCaller } from '../app-router';
import { createSession, verifyCredentials } from '../../auth/auth.service';
import { loginThrottle } from '../../auth/login-throttle';
import type { Db } from '@invoices/db';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());
beforeEach(async () => {
  loginThrottle.reset();
  await truncateAll(db);
});

describe('auth', () => {
  it('register creates user + settings row and logs in (session cookie set)', async () => {
    const ctx = createTestContext(db);
    const caller = createCaller(ctx);
    const res = await caller.auth.register({ username: 'jozef', password: 'password123' });
    expect(res.username).toBe('jozef');
    const allSettings = await db.select().from(settings);
    expect(allSettings).toHaveLength(1);
    expect(ctx.cookieJar.token).toBeDefined();
    await expect(resolveUserId(db, ctx.cookieJar.token)).resolves.toBe(res.id);
  });

  it('register rejects duplicate username with CONFLICT', async () => {
    const caller = createCaller(createTestContext(db));
    await caller.auth.register({ username: 'jozef', password: 'password123' });
    await expect(
      createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('login works with correct password, fails with wrong', async () => {
    await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const ctx = createTestContext(db);
    const caller = createCaller(ctx);
    await expect(caller.auth.login({ username: 'jozef', password: 'password123' })).resolves.toMatchObject({ username: 'jozef' });
    expect(ctx.cookieJar.token).toBeDefined();
    await expect(caller.auth.login({ username: 'jozef', password: 'wrongwrong' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('password is stored hashed, never plaintext', async () => {
    await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const [u] = await db.select().from(users);
    expect(u.passwordHash).not.toContain('password123');
    expect(u.passwordHash).toMatch(/^\$argon2/);
  });

  it('me returns user when authed, null when not; logout invalidates session', async () => {
    const ctx = createTestContext(db);
    const caller = createCaller(ctx);
    await caller.auth.register({ username: 'jozef', password: 'password123' });
    const token = ctx.cookieJar.token!;
    // simulate next request with resolved userId
    const userId = await resolveUserId(db, token);
    const authedCaller = createCaller(Object.assign(createTestContext(db, userId), { cookieJar: { token } }));
    await expect(authedCaller.auth.me()).resolves.toMatchObject({ username: 'jozef' });
    await authedCaller.auth.logout();
    await expect(resolveUserId(db, token)).resolves.toBeNull();
    const anonCaller = createCaller(createTestContext(db));
    await expect(anonCaller.auth.me()).resolves.toBeNull();
  });
});

describe('auth.changePassword', () => {
  async function registerAndAuthCaller() {
    const regCtx = createTestContext(db);
    await createCaller(regCtx).auth.register({ username: 'jozef', password: 'password123' });
    const token = regCtx.cookieJar.token!;
    const userId = await resolveUserId(db, token);
    const ctx = Object.assign(createTestContext(db, userId), { cookieJar: { token } });
    return { ctx, caller: createCaller(ctx), token };
  }

  it('happy path: changes password, old fails and new works via verifyCredentials', async () => {
    const { caller } = await registerAndAuthCaller();
    await expect(
      caller.auth.changePassword({ currentPassword: 'password123', newPassword: 'newpassword456' }),
    ).resolves.toEqual({ ok: true });

    await expect(verifyCredentials(db, { username: 'jozef', password: 'newpassword456' })).resolves.toMatchObject({
      username: 'jozef',
    });
    await expect(
      verifyCredentials(db, { username: 'jozef', password: 'password123' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects wrong currentPassword with exact Slovak UNAUTHORIZED message', async () => {
    const { caller } = await registerAndAuthCaller();
    await expect(
      caller.auth.changePassword({ currentPassword: 'wrong-password', newPassword: 'newpassword456' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Nesprávne aktuálne heslo' });
  });

  it('invalidates all other sessions but keeps the current one', async () => {
    const { ctx, caller, token: tokenA } = await registerAndAuthCaller();
    const tokenB = await createSession(db, ctx.userId!);

    await expect(
      caller.auth.changePassword({ currentPassword: 'password123', newPassword: 'newpassword456' }),
    ).resolves.toEqual({ ok: true });

    await expect(resolveUserId(db, tokenA)).resolves.toBe(ctx.userId);
    await expect(resolveUserId(db, tokenB)).resolves.toBeNull();
  });
});

describe('registration toggle', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is closed in production unless REGISTRATION_ENABLED=true', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REGISTRATION_ENABLED', '');
    const caller = createCaller(createTestContext(db));
    await expect(caller.auth.registrationEnabled()).resolves.toBe(false);
    await expect(caller.auth.register({ username: 'stranger', password: 'password123' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await db.select().from(users)).toHaveLength(0);

    vi.stubEnv('REGISTRATION_ENABLED', 'true');
    await expect(caller.auth.registrationEnabled()).resolves.toBe(true);
    await expect(caller.auth.register({ username: 'owner', password: 'password123' })).resolves.toBeTruthy();
  });

  it('is open outside production unless REGISTRATION_ENABLED=false', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('REGISTRATION_ENABLED', '');
    const caller = createCaller(createTestContext(db));
    await expect(caller.auth.registrationEnabled()).resolves.toBe(true);

    vi.stubEnv('REGISTRATION_ENABLED', 'false');
    await expect(caller.auth.registrationEnabled()).resolves.toBe(false);
    await expect(caller.auth.register({ username: 'dev', password: 'password123' }))
      .rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('login throttle', () => {
  it('6th attempt from one IP gets TOO_MANY_REQUESTS even with the right password; another IP logs in', async () => {
    await createCaller(createTestContext(db)).auth.register({ username: 'carnaby', password: 'password123' });
    const attacker = createCaller(createTestContext(db, null, '203.0.113.7'));
    for (let i = 0; i < 5; i++) {
      await expect(attacker.auth.login({ username: 'carnaby', password: 'wrongwrong' }))
        .rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    }
    await expect(attacker.auth.login({ username: 'carnaby', password: 'password123' }))
      .rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' });

    const owner = createTestContext(db, null, '198.51.100.1');
    await expect(createCaller(owner).auth.login({ username: 'carnaby', password: 'password123' }))
      .resolves.toMatchObject({ username: 'carnaby' });
    expect(owner.cookieJar.token).toBeDefined();
  });
});
