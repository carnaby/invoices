import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import cookieParser from 'cookie-parser';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import { invoiceOriginals, type Db } from '@invoices/db';
import { createCaller } from '../trpc/app-router';
import { createTestContext } from '../trpc/context';
import { createSession } from '../auth/auth.service';
import { createFilesRouter } from './files';

let db: Db;
let closeDb: () => Promise<void>;
let server: Server;
let base: string;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  closeDb = t.close;
  const app = express();
  app.use(cookieParser());
  app.use('/files', createFilesRouter(db));
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  server.close();
  await closeDb();
});
beforeEach(async () => truncateAll(db));

const ORIGINAL = Buffer.from('%PDF-1.4 original from iDoklad');

async function userWithInvoice(username: string, withOriginal: boolean) {
  const u = await createCaller(createTestContext(db)).auth.register({ username, password: 'password123' });
  const caller = createCaller(createTestContext(db, u.id));
  const { id } = await caller.invoices.create({
    number: '20260001', customerName: 'Test s.r.o.', issueDate: '2026-01-10', dueDate: '2026-01-24',
    deliveryDate: '2026-01-10', items: [{ description: 'X', quantity: 1, unitPrice: 100, vatRate: 0 }],
  });
  if (withOriginal) {
    await db.insert(invoiceOriginals).values({ invoiceId: id, pdf: ORIGINAL, fileName: 'faktura-20260001.pdf' });
  }
  return { id, cookie: `sid=${await createSession(db, u.id)}` };
}

const original = (id: string, cookie?: string) =>
  fetch(`${base}/files/invoices/${id}/original`, { headers: cookie ? { cookie } : {} });

describe('GET /files/invoices/:id/original', () => {
  it('returns the stored bytes to the owner', async () => {
    const { id, cookie } = await userWithInvoice('jozef', true);
    const res = await original(id, cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(res.headers.get('content-disposition')).toBe('inline; filename="faktura-20260001-original.pdf"');
    expect(Buffer.compare(Buffer.from(await res.arrayBuffer()), ORIGINAL)).toBe(0);
  });

  it('401 without a session', async () => {
    const { id } = await userWithInvoice('jozef', true);
    expect((await original(id)).status).toBe(401);
  });

  it('404 for another user', async () => {
    const { id } = await userWithInvoice('jozef', true);
    const { cookie } = await userWithInvoice('cudzi', false);
    const res = await original(id, cookie);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Faktúra neexistuje' });
  });

  it('404 when the invoice has no original, and for a malformed id', async () => {
    const { id, cookie } = await userWithInvoice('jozef', false);
    const res = await original(id, cookie);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Originál neexistuje' });
    expect((await original('not-a-uuid', cookie)).status).toBe(404);
  });
});
