import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, truncateAll, TEST_DB_URL } from '@invoices/db/src/testing';
import { eq } from 'drizzle-orm';
import { createDb, invoiceOriginals, invoices, type Db } from '@invoices/db';
import { createTestContext } from '../context';
import { createCaller } from '../app-router';
import { todayIso } from '../../invoices/invoices.service';
import { formatMoney } from '@invoices/shared';

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

  it('addPayment adds partial payments to the paid amount and keeps the latest date', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.addPayment({ id, amount: 100.1, paidDate: '2026-02-01' });
    await caller.invoices.addPayment({ id, amount: 189.9, paidDate: '2026-03-15' });
    const { invoice } = await caller.invoices.get({ id });
    expect(invoice.paidAmount).toBe(290);
    expect(invoice.paidDate).toBe('2026-03-15');
  });

  it('addPayment defaults paidDate to today and rejects non-positive amounts', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.addPayment({ id, amount: 50 });
    expect((await caller.invoices.get({ id })).invoice.paidDate).toBe(todayIso());
    await expect(caller.invoices.addPayment({ id, amount: 0 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.invoices.addPayment({ id, amount: -10 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(50);
  });

  it('addPayment refuses a payment above the remaining amount and accepts exactly the remainder', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice); // total 290
    await caller.invoices.addPayment({ id, amount: 100 });
    await expect(caller.invoices.addPayment({ id, amount: 190.01 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `Úhrada presahuje zostávajúcu sumu ${formatMoney(190)}.`,
    });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(100);
    await caller.invoices.addPayment({ id, amount: 190 });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(290);
    await expect(caller.invoices.addPayment({ id, amount: 0.01 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('half-cent amounts are rounded before the check, so they cannot overpay by a cent', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice); // total 290
    await caller.invoices.addPayment({ id, amount: 289 });
    await expect(caller.invoices.addPayment({ id, amount: 1.005 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    await expect(caller.invoices.markPaid({ id, paidAmount: 290.005 })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(289);
  });

  it('addPayment: two payments at once cannot together exceed the total', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice); // total 290
    const results = await Promise.allSettled([
      caller.invoices.addPayment({ id, amount: 200 }),
      caller.invoices.addPayment({ id, amount: 200 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(200);
  });

  it('markPaid refuses an amount above the invoice total', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice); // total 290
    await expect(caller.invoices.markPaid({ id, paidAmount: 290.01 })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `Úhrada presahuje sumu faktúry ${formatMoney(290)}.`,
    });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(0);
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
    expect(all2026.summary).toMatchObject({
      count: 3,
      byCurrency: [{ currency: 'EUR', total: 680, unpaid: 390 }],
    });

    expect((await caller.invoices.list({ year: 2026, status: 'paid' })).invoices.map((i) => i.number)).toEqual(['20260003']);
    expect((await caller.invoices.list({ year: 2026, status: 'overdue' })).invoices.map((i) => i.number)).toEqual(['20260001']);
    expect((await caller.invoices.list({ search: 'iná fir' })).invoices).toHaveLength(1);
    expect((await caller.invoices.list({ search: '2025' })).invoices).toHaveLength(1);
  });

  it('list summary.byCurrency keeps currencies separate, ordered by count desc then currency asc', async () => {
    const caller = await newUserCaller('jozef');
    await caller.invoices.create(baseInvoice); // EUR, total 290
    await caller.invoices.create({
      ...baseInvoice, number: '20260002', currency: 'CZK',
      items: [{ description: 'X', quantity: 1, unitPrice: 1000, vatRate: 0 }],
    }); // CZK, total 1000
    const { id: paidId } = await caller.invoices.create({
      ...baseInvoice, number: '20260003', currency: 'CZK',
      items: [{ description: 'Y', quantity: 1, unitPrice: 500, vatRate: 0 }],
    });
    await caller.invoices.markPaid({ id: paidId, paidAmount: 200, paidDate: '2026-02-01' });

    const { summary } = await caller.invoices.list({});
    expect(summary.count).toBe(3);
    // CZK has 2 invoices, EUR has 1 → CZK first
    expect(summary.byCurrency).toEqual([
      { currency: 'CZK', total: 1500, unpaid: 1300 },
      { currency: 'EUR', total: 290, unpaid: 290 },
    ]);
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
    await expect(b.invoices.addPayment({ id, amount: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await a.invoices.get({ id })).invoice.paidAmount).toBe(0);
    await expect(b.invoices.remove({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

async function lock(id: string) {
  await db.update(invoices).set({ lockedAt: new Date() }).where(eq(invoices.id, id));
}

describe('locked invoices (imported from iDoklad)', () => {
  it('update of a locked invoice answers FORBIDDEN even with a single-connection pool', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const { id } = await createCaller(createTestContext(db, u.id)).invoices.create(baseInvoice);
    await lock(id);
    // The lookup after a failed guarded update must run inside the transaction,
    // not wait for a second pool connection while the transaction holds the only one.
    const single = createDb(TEST_DB_URL);
    (single.$pool.options as { max: number }).max = 1;
    try {
      const caller = createCaller(createTestContext(single, u.id));
      await expect(caller.invoices.update({ id, data: baseInvoice })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      await single.$pool.end();
    }
  }, 5000);

  it('update and remove are FORBIDDEN and change nothing, items included', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await lock(id);

    const changed = {
      ...baseInvoice,
      customerName: 'Zmenené s.r.o.',
      items: [{ description: 'Iné', quantity: 1, unitPrice: 1, vatRate: 0 }],
    };
    await expect(caller.invoices.update({ id, data: changed })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.',
    });
    await expect(caller.invoices.remove({ id })).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const { invoice, items } = await caller.invoices.get({ id });
    expect(invoice.customerName).toBe('Test s.r.o.');
    expect(items.map((i) => i.description)).toEqual(['Programátorské práce', 'Konzultácie']);
  });

  it('another user gets NOT_FOUND, not FORBIDDEN, for a locked invoice', async () => {
    const owner = await newUserCaller('jozef');
    const { id } = await owner.invoices.create(baseInvoice);
    await lock(id);
    const other = await newUserCaller('cudzi');
    await expect(other.invoices.remove({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(other.invoices.update({ id, data: baseInvoice })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('payments still work on a locked invoice', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await lock(id);
    await caller.invoices.addPayment({ id, amount: 100, paidDate: '2026-12-01' });
    await caller.invoices.addPayment({ id, amount: 90, paidDate: '2026-12-15' });
    const { invoice } = await caller.invoices.get({ id });
    expect(invoice.paidAmount).toBe(190);
    expect(invoice.paidDate).toBe('2026-12-15');
    await caller.invoices.markPaid({ id, paidAmount: 290, paidDate: '2026-12-20' });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(290);
  });

  it('get reports locked and hasOriginal', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    expect(await caller.invoices.get({ id })).toMatchObject({ locked: false, hasOriginal: false });

    await lock(id);
    await db.insert(invoiceOriginals).values({
      invoiceId: id, pdf: Buffer.from('%PDF-1.4 x'), fileName: 'faktura-20260001.pdf',
    });
    expect(await caller.invoices.get({ id })).toMatchObject({ locked: true, hasOriginal: true });
  });

  it('unlocked invoices can still be updated and removed', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.update({ id, data: { ...baseInvoice, customerName: 'Nové s.r.o.' } });
    expect((await caller.invoices.get({ id })).invoice.customerName).toBe('Nové s.r.o.');
    await expect(caller.invoices.remove({ id })).resolves.toEqual({ ok: true });
  });
});

const PAID_LOCKED = 'Uhradená faktúra je uzamknutá a nedá sa meniť ani zmazať.';

describe('paid invoices are locked', () => {
  it('a fully paid invoice cannot be updated or removed and get reports the reason', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice); // total 290
    await caller.invoices.addPayment({ id, amount: 290 });
    await expect(caller.invoices.update({ id, data: { ...baseInvoice, customerName: 'Iná' } })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: PAID_LOCKED,
    });
    await expect(caller.invoices.remove({ id })).rejects.toMatchObject({ code: 'FORBIDDEN', message: PAID_LOCKED });
    const got = await caller.invoices.get({ id });
    expect(got.invoice.customerName).toBe('Test s.r.o.');
    expect(got).toMatchObject({ locked: true, lockReason: 'paid' });
  });

  it('a partially paid invoice can be edited, but its total cannot drop below the paid amount', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.addPayment({ id, amount: 100 });
    expect(await caller.invoices.get({ id })).toMatchObject({ locked: false, lockReason: null });

    const items = (unitPrice: number) => [{ description: 'X', quantity: 1, unitPrice, vatRate: 0 }];
    await expect(caller.invoices.update({ id, data: { ...baseInvoice, items: items(99.99) } })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: `Suma faktúry nemôže byť nižšia ako už uhradených ${formatMoney(100)}.`,
    });
    expect((await caller.invoices.get({ id })).totals.total).toBe(290);

    await caller.invoices.update({ id, data: { ...baseInvoice, items: items(150) } });
    expect((await caller.invoices.get({ id })).totals.total).toBe(150);
  });

  it('a credit note (negative total, nothing paid) can still be edited', async () => {
    const caller = await newUserCaller('jozef');
    const credit = { ...baseInvoice, items: [{ description: 'Dobropis', quantity: 1, unitPrice: -50, vatRate: 0 }] };
    const { id } = await caller.invoices.create(credit);
    await caller.invoices.update({ id, data: { ...credit, customerName: 'Iná' } });
    expect((await caller.invoices.get({ id })).invoice.customerName).toBe('Iná');
  });

  it('the total is checked as stored (rounded), so extra decimals cannot sneak below the paid amount', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.addPayment({ id, amount: 100 });
    // 3 x 33.334 = 100.00 as typed, but unit_price is stored as 33.33, so 99.99.
    const items = [{ description: 'X', quantity: 3, unitPrice: 33.334, vatRate: 0 }];
    await expect(caller.invoices.update({ id, data: { ...baseInvoice, items } })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect((await caller.invoices.get({ id })).totals.total).toBe(290);
  });

  it('an invoice with a zero total is not locked', async () => {
    const caller = await newUserCaller('jozef');
    const zero = { ...baseInvoice, items: [{ description: 'Zadarmo', quantity: 1, unitPrice: 0, vatRate: 0 }] };
    const { id } = await caller.invoices.create(zero);
    expect(await caller.invoices.get({ id })).toMatchObject({ locked: false, lockReason: null });
    await caller.invoices.update({ id, data: { ...zero, customerName: 'Iná' } });
    await caller.invoices.remove({ id });
  });

  it('the iDoklad reason wins when an imported invoice is also paid', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await lock(id);
    await caller.invoices.addPayment({ id, amount: 290 });
    expect(await caller.invoices.get({ id })).toMatchObject({ locked: true, lockReason: 'idoklad' });
  });

  it('resetPayments clears the paid amount and date and unlocks a paid invoice', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create(baseInvoice);
    await caller.invoices.addPayment({ id, amount: 290, paidDate: '2026-02-01' });
    await caller.invoices.resetPayments({ id });
    const got = await caller.invoices.get({ id });
    expect(got.invoice).toMatchObject({ paidAmount: 0, paidDate: null });
    expect(got).toMatchObject({ locked: false, lockReason: null });
    await caller.invoices.remove({ id });
  });

  it('resetPayments keeps the iDoklad lock and is NOT_FOUND for another user', async () => {
    const owner = await newUserCaller('jozef');
    const { id } = await owner.invoices.create(baseInvoice);
    await lock(id);
    await owner.invoices.addPayment({ id, amount: 100 });
    const other = await newUserCaller('cudzi');
    await expect(other.invoices.resetPayments({ id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect((await owner.invoices.get({ id })).invoice.paidAmount).toBe(100);
    await owner.invoices.resetPayments({ id });
    expect(await owner.invoices.get({ id })).toMatchObject({ locked: true, lockReason: 'idoklad' });
    expect((await owner.invoices.get({ id })).invoice.paidAmount).toBe(0);
  });

  it('markPaid can always set the paid amount to 0, even for a negative total', async () => {
    const caller = await newUserCaller('jozef');
    const { id } = await caller.invoices.create({
      ...baseInvoice, items: [{ description: 'Dobropis', quantity: 1, unitPrice: -50, vatRate: 0 }],
    });
    await caller.invoices.markPaid({ id, paidAmount: 0 });
    expect((await caller.invoices.get({ id })).invoice.paidAmount).toBe(0);
  });
});
