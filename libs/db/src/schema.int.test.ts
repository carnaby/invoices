import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, truncateAll } from './testing';
import { users, contacts, invoices, invoiceItems, settings } from './schema';
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
    expect(rows[0].paidAmount).toBe(0);
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
});
