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
    expect(s.byCurrency).toHaveLength(1);
    const eur = s.byCurrency[0];
    expect(eur.currency).toBe('EUR');
    expect(eur.invoicedTotal).toBe(1800);
    expect(eur.paidTotal).toBe(600);
    expect(eur.unpaidTotal).toBe(1200);
    expect(eur.overdueCount).toBe(1);
    expect(eur.overdueTotal).toBe(1000);
    expect(eur.monthly[0]).toBe(1000); // January
    expect(eur.monthly[2]).toBe(800);  // March
    expect(eur.monthly.reduce((a, b) => a + b, 0)).toBe(1800);
    expect(s.recent).toHaveLength(4);
    expect(s.recent[0].number).toBe('20260003');
    expect(s.years.sort()).toEqual([2025, 2026]);
  });

  it('returns empty byCurrency for empty year', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    const s = await caller.dashboard.stats({ year: 2026 });
    expect(s.byCurrency).toEqual([]);
    expect(s.recent).toEqual([]);
  });

  it('keeps EUR and CZK invoices in separate buckets with their own monthly arrays', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    await caller.invoices.create(inv('20260001', '2026-01-10', '2026-01-24', 1000)); // EUR
    await caller.invoices.create({
      ...inv('20260002', '2026-02-05', '2026-02-19', 2000), currency: 'CZK',
    });
    const { id: czkId } = await caller.invoices.create({
      ...inv('20260003', '2026-02-15', '2026-03-01', 500), currency: 'CZK',
    });
    await caller.invoices.markPaid({ id: czkId, paidAmount: 500, paidDate: '2026-02-20' });

    const s = await caller.dashboard.stats({ year: 2026 });
    expect(s.byCurrency).toHaveLength(2);
    // CZK has 2 invoices, EUR has 1 → CZK first
    expect(s.byCurrency[0].currency).toBe('CZK');
    expect(s.byCurrency[0].invoicedTotal).toBe(2500);
    expect(s.byCurrency[0].paidTotal).toBe(500);
    expect(s.byCurrency[0].monthly[1]).toBe(2500); // February
    expect(s.byCurrency[0].monthly.reduce((a, b) => a + b, 0)).toBe(2500);

    expect(s.byCurrency[1].currency).toBe('EUR');
    expect(s.byCurrency[1].invoicedTotal).toBe(1000);
    expect(s.byCurrency[1].monthly[0]).toBe(1000);
  });
});
