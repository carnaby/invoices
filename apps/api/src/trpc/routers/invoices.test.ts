import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import type { Db } from '@invoices/db';
import { createTestContext } from '../context';
import { createCaller } from '../app-router';
import { todayIso } from '../../invoices/invoices.service';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => close());
beforeEach(async () => truncateAll(db));

async function newUserCaller(username: string) {
  const u = await createCaller(createTestContext(db)).auth.register({ username, password: 'password123' });
  return createCaller(createTestContext(db, u.id));
}

const baseInvoice = {
  number: '20260001',
  customerName: 'Test s.r.o.',
  issueDate: '2026-01-10',
  dueDate: '2026-01-24',
  deliveryDate: '2026-01-10',
  items: [
    { description: 'Programátorské práce', quantity: 2, unitPrice: 100, vatRate: 20 },
    { description: 'Konzultácie', quantity: 1, unitPrice: 50, vatRate: 0 },
  ],
};

describe('invoices', () => {
  it('create + get returns items and computed totals; VS defaults to number', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    const { invoice, items, totals } = await caller.invoices.get({ id });
    expect(invoice.variableSymbol).toBe('20260001');
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.position)).toEqual([1, 2]);
    expect(totals).toMatchObject({ base: 250, vat: 40, total: 290 });
    expect(totals.vatSummary).toHaveLength(2);
  });

  it('duplicate number → CONFLICT; same number for another user is fine', async () => {
    const a = await newUserCaller('alice');
    const b = await newUserCaller('bob');
    await a.invoices.create(baseInvoice);
    await expect(a.invoices.create(baseInvoice)).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(b.invoices.create(baseInvoice)).resolves.toBeTruthy();
  });

  it('suggestNumber uses per-user sequence', async () => {
    const caller = await newUserCaller('jozef');
    expect((await caller.invoices.suggestNumber({ year: 2026 })).number).toBe('20260001');
    await caller.invoices.create(baseInvoice);
    expect((await caller.invoices.suggestNumber({ year: 2026 })).number).toBe('20260002');
    expect((await caller.invoices.suggestNumber({ year: 2027 })).number).toBe('20270001');
  });

  it('update replaces items and recomputes totals', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.update({
      id,
      data: { ...baseInvoice, items: [{ description: 'Nová položka', quantity: 1, unitPrice: 999, vatRate: 0 }] },
    });
    const { items, totals } = await caller.invoices.get({ id });
    expect(items).toHaveLength(1);
    expect(totals.total).toBe(999);
  });

  it('markPaid sets amount and defaults paidDate to today', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.markPaid({ id, paidAmount: 290 });
    const { invoice } = await caller.invoices.get({ id });
    expect(invoice.paidAmount).toBe(290);
    expect(invoice.paidDate).toBe(todayIso());
  });

  it('list filters by year, status, search and returns summary + years', async () => {
    const caller = await newUserCaller('jozef');
    await caller.invoices.create(baseInvoice); // 2026, unpaid, past due → overdue (total 290)
    await caller.invoices.create({
      ...baseInvoice, number: '20260002', customerName: 'Iná firma a.s.',
      issueDate: '2026-06-01', dueDate: '2099-01-01', deliveryDate: '2026-06-01',
      items: [{ description: 'X', quantity: 1, unitPrice: 100, vatRate: 0 }],
    }); // unpaid, not due yet
    await caller.invoices.create({
      ...baseInvoice, number: '20250001',
      issueDate: '2025-03-01', dueDate: '2025-03-15', deliveryDate: '2025-03-01',
    }); // 2025
    const { id: paidId } = await caller.invoices.create({ ...baseInvoice, number: '20260003' });
    await caller.invoices.markPaid({ id: paidId, paidAmount: 290, paidDate: '2026-02-01' });

    const all2026 = await caller.invoices.list({ year: 2026 });
    expect(all2026.invoices).toHaveLength(3);
    expect(all2026.invoices[0].number).toBe('20260003'); // desc order
    expect(all2026.years.sort()).toEqual([2025, 2026]);
    expect(all2026.summary).toMatchObject({ count: 3, total: 680, unpaid: 390 });

    expect((await caller.invoices.list({ year: 2026, status: 'paid' })).invoices.map((i) => i.number)).toEqual(['20260003']);
    expect((await caller.invoices.list({ year: 2026, status: 'overdue' })).invoices.map((i) => i.number)).toEqual(['20260001']);
    expect((await caller.invoices.list({ search: 'iná fir' })).invoices).toHaveLength(1);
    expect((await caller.invoices.list({ search: '2025' })).invoices).toHaveLength(1);
  });

  it('remove deletes invoice with items', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.remove({ id });
    await expect(caller.invoices.get({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('tenant isolation on get/update/markPaid/remove', async () => {
    const a = await newUserCaller('alice');
    const b = await newUserCaller('bob');
    const { id } = await a.invoices.create(baseInvoice);
    await expect(b.invoices.get({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.invoices.update({ id, data: baseInvoice })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.invoices.markPaid({ id, paidAmount: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(b.invoices.remove({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
