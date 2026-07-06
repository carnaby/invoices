import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createTestDb } from '@invoices/db/src/testing';
import { createTestContext } from './context';
import { createCaller } from './app-router';

let db: Awaited<ReturnType<typeof createTestDb>>['db'];
let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());

describe('appRouter', () => {
  it('health.ping returns ok', async () => {
    const caller = createCaller(createTestContext(db));
    await expect(caller.health.ping()).resolves.toEqual({ ok: true });
  });
});
