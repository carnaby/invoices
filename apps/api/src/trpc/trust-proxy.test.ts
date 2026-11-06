import type { AddressInfo } from 'node:net';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Db } from '@invoices/db';
import { createContextFactory } from './context';
import { TRUST_PROXY } from './trust-proxy';

// The same setting as main.ts on a plain Express app. The test request comes from loopback,
// like Caddy's request comes from the private docker network.
let base: string;
let close: () => void;
beforeAll(async () => {
  const app = express();
  app.set('trust proxy', TRUST_PROXY);
  app.get('/ip', (req, res) => {
    res.send(req.ip);
  });
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

describe('trust proxy', () => {
  it('takes the visitor IP from X-Forwarded-For sent by a local proxy', async () => {
    const res = await fetch(`${base}/ip`, { headers: { 'X-Forwarded-For': '203.0.113.7' } });
    expect(await res.text()).toBe('203.0.113.7');
  });
  it('a spoofed left-hand entry does not win over the address the proxy saw', async () => {
    const res = await fetch(`${base}/ip`, { headers: { 'X-Forwarded-For': '1.2.3.4, 203.0.113.7' } });
    expect(await res.text()).toBe('203.0.113.7');
  });
});

describe('session cookie', () => {
  const run = async () => {
    const res = { cookie: vi.fn(), clearCookie: vi.fn() };
    const req = { cookies: {}, ip: '203.0.113.7' };
    const ctx = await createContextFactory({} as Db)({ req, res } as never);
    ctx.setSessionCookie('token');
    ctx.setSessionCookie(null);
    return { ctx, set: res.cookie.mock.calls[0][2], cleared: res.clearCookie.mock.calls[0][1] };
  };
  afterAll(() => vi.unstubAllEnvs());

  it('is Secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { ctx, set, cleared } = await run();
    expect(set).toMatchObject({ secure: true, httpOnly: true, sameSite: 'lax' });
    expect(cleared).toMatchObject({ secure: true });
    expect(ctx.clientIp).toBe('203.0.113.7');
  });
  it('is not Secure in development (plain http on localhost)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect((await run()).set).toMatchObject({ secure: false });
  });
});
