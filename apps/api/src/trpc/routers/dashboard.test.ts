import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import type { Db } from '@invoices/db';
import { createTestContext } from '../context';
import { createCaller } from '../app-router';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());
beforeEach(async () => truncateAll(db));

const inv = (number: string, issueDate: string, dueDate: string, price: number) => ({
  number, customerName: 'Test s.r.o.', issueDate, dueDate, deliveryDate: issueDate,
  items: [{ description: 'X', quantity: 1, unitPrice: price, vatRate: 0 }],
});

describe('dashboard.stats', () => {
  it('aggregates tiles, monthly buckets and recent invoices', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    await caller.invoices.create(inv('20260001', '2026-01-10', '2026-01-24', 1000)); // overdue unpaid
    const { id } = await caller.invoices.create(inv('20260002', '2026-03-05', '2026-03-19', 500));
    await caller.invoices.markPaid({ id, paidAmount: 500, paidDate: '2026-03-10' });
    const { id: partId } = await caller.invoices.create(inv('20260003', '2026-03-20', '2099-12-31', 300));
    await caller.invoices.markPaid({ id: partId, paidAmount: 100, paidDate: '2026-03-25' });
    await caller.invoices.create(inv('20250001', '2025-11-01', '2025-11-15', 700)); // other year

    const s = await caller.dashboard.stats({ year: 2026 });
    expect(s.invoicedTotal).toBe(1800);
    expect(s.paidTotal).toBe(600);
    expect(s.unpaidTotal).toBe(1200);
    expect(s.overdueCount).toBe(1);
    expect(s.overdueTotal).toBe(1000);
    expect(s.monthly[0]).toBe(1000); // January
    expect(s.monthly[2]).toBe(800);  // March
    expect(s.monthly.reduce((a, b) => a + b, 0)).toBe(1800);
    expect(s.recent).toHaveLength(4);
    expect(s.recent[0].number).toBe('20260003');
    expect(s.years.sort()).toEqual([2025, 2026]);
  });

  it('returns zeros for empty year', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    const s = await caller.dashboard.stats({ year: 2026 });
    expect(s.invoicedTotal).toBe(0);
    expect(s.monthly).toEqual(Array(12).fill(0));
    expect(s.recent).toEqual([]);
  });
});
