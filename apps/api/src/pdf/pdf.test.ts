import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import type { Db } from '@invoices/db';
import { createTestContext } from '../trpc/context';
import { createCaller } from '../trpc/app-router';
import { generateInvoicePdf, closeBrowser } from './pdf.service';

let db: Db; let close: () => Promise<void>;
beforeAll(async () => { const t = await createTestDb(); db = t.db; close = t.close; });
afterAll(async () => { await closeBrowser(); await close(); });
beforeEach(async () => truncateAll(db));

describe('generateInvoicePdf', () => {
  it('produces a PDF containing invoice number, customer, supplier, totals', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    await caller.settings.update({
      supplierName: 'Ján Testovací', supplierStreet: 'Testovacia 1', supplierZip: '036 01',
      supplierCity: 'Martin', supplierIco: '12345678',
      iban: 'SK3112000000198742637541', swift: 'TESTSKBX',
      registrationText: 'Zapísaný v testovacom registri, č. 123',
    });
    const { id } = await caller.invoices.create({
      number: '20260001', customerName: 'Test s.r.o.', customerStreet: 'Ulica 2',
      customerCity: 'Bratislava', customerIco: '87654321',
      issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      introText: 'Fakturujem Vám za služby', note: 'Prenesenie daňovej povinnosti',
      items: [{ description: 'Programátorské práce', quantity: 1, unitPrice: 3024, vatRate: 0 }],
    });
    const pdf = await generateInvoicePdf(db, u.id, id);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const { default: pdfParse } = await import('pdf-parse');
    const parsed = await pdfParse(pdf);
    for (const expected of [
      '20260001', 'Test s.r.o.', 'Ján Testovací', 'Faktúra', '3 024,00',
      'SK31 1200 0000 1987 4263 7541', 'Prenesenie daňovej povinnosti',
      'Zapísaný v testovacom registri', 'Spolu na úhradu',
    ]) {
      expect(parsed.text).toContain(expected);
    }
  }, 60000);

  it('404s for foreign invoice', async () => {
    const anon = createCaller(createTestContext(db));
    const a = await anon.auth.register({ username: 'alice', password: 'password123' });
    const b = await createCaller(createTestContext(db)).auth.register({ username: 'bob', password: 'password123' });
    const callerA = createCaller(createTestContext(db, a.id));
    const { id } = await callerA.invoices.create({
      number: '20260001', customerName: 'X', issueDate: '2026-01-10', dueDate: '2026-01-24',
      deliveryDate: '2026-01-10', items: [{ description: 'Y', quantity: 1, unitPrice: 1, vatRate: 0 }],
    });
    await expect(generateInvoicePdf(db, b.id, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  }, 60000);
});
