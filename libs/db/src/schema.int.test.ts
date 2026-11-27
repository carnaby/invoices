import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, truncateAll } from './testing';
import { eq } from 'drizzle-orm';
import { users, contacts, invoices, invoiceItems, invoiceOriginals, invoicePayments, settings } from './schema';
import type { Db } from './client';

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  const t = await createTestDb();
  db = t.db;
  close = t.close;
});
afterAll(async () => close());
beforeEach(async () => truncateAll(db));

describe('schema', () => {
  it('inserts user with settings, contact, invoice with items', async () => {
    const [u] = await db.insert(users).values({ username: 'tester', passwordHash: 'x' }).returning();
    await db.insert(settings).values({ userId: u.id });
    const [c] = await db
      .insert(contacts)
      .values({ userId: u.id, companyName: 'Test s.r.o.' })
      .returning();
    const [inv] = await db
      .insert(invoices)
      .values({
        userId: u.id,
        contactId: c.id,
        number: '20260001',
        customerName: 'Test s.r.o.',
        issueDate: '2026-01-10',
        dueDate: '2026-01-24',
        deliveryDate: '2026-01-10',
      })
      .returning();
    await db.insert(invoiceItems).values({
      invoiceId: inv.id,
      position: 1,
      description: 'Práce',
      quantity: 2,
      unitPrice: 100,
      vatRate: 20,
    });
    const rows = await db.select().from(invoices);
    expect(rows).toHaveLength(1);
    expect(rows[0].currency).toBe('EUR');
  });

  async function newInvoice() {
    const [u] = await db.insert(users).values({ username: 'platby', passwordHash: 'x' }).returning();
    const [inv] = await db
      .insert(invoices)
      .values({
        userId: u.id, number: '20260001', customerName: 'Test s.r.o.',
        issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      })
      .returning();
    return inv;
  }

  it('payments cascade with their invoice', async () => {
    const inv = await newInvoice();
    await db.insert(invoicePayments).values([
      { invoiceId: inv.id, paidOn: '2026-02-01', amount: 10.5 },
      { invoiceId: inv.id, paidOn: '2026-02-01', amount: 20 },
    ]);
    expect(await db.select().from(invoicePayments)).toHaveLength(2);
    await db.delete(invoices).where(eq(invoices.id, inv.id));
    expect(await db.select().from(invoicePayments)).toHaveLength(0);
  });

  it('rejects a non-positive payment', async () => {
    const inv = await newInvoice();
    await expect(db.insert(invoicePayments).values({ invoiceId: inv.id, paidOn: '2026-02-01', amount: 0 })).rejects.toThrow();
  });

  it('enforces unique invoice number per user', async () => {
    const [u] = await db.insert(users).values({ username: 'a', passwordHash: 'x' }).returning();
    const base = {
      userId: u.id, number: '20260001', customerName: 'X',
      issueDate: '2026-01-01', dueDate: '2026-01-15', deliveryDate: '2026-01-01',
    };
    await db.insert(invoices).values(base);
    await expect(db.insert(invoices).values(base)).rejects.toThrow();
  });

  it('stores an original PDF per invoice and deletes it with the invoice; locked_at defaults to null', async () => {
    const [u] = await db.insert(users).values({ username: 'tester', passwordHash: 'x' }).returning();
    const [inv] = await db
      .insert(invoices)
      .values({
        userId: u.id, number: '20260001', customerName: 'Test s.r.o.',
        issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      })
      .returning();
    expect(inv.lockedAt).toBeNull();

    const pdf = Buffer.from('%PDF-1.4 test original');
    await db.insert(invoiceOriginals).values({ invoiceId: inv.id, pdf, fileName: 'faktura-20260001.pdf' });
    const [stored] = await db.select().from(invoiceOriginals).where(eq(invoiceOriginals.invoiceId, inv.id));
    expect(Buffer.compare(stored.pdf, pdf)).toBe(0);
    expect(stored.fileName).toBe('faktura-20260001.pdf');

    await db.delete(invoices).where(eq(invoices.id, inv.id));
    expect(await db.select().from(invoiceOriginals)).toHaveLength(0);
  });
});
