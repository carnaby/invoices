import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createTestDb, truncateAll } from '@invoices/db/src/testing';
import type { Db } from '@invoices/db';
import { createTestContext } from '../trpc/context';
import { createCaller } from '../trpc/app-router';
import { setTransportFactory } from './email.service';
import { closeBrowser } from '../pdf/pdf.service';

let db: Db; let close: () => Promise<void>;
const sent: any[] = [];

beforeAll(async () => {
  const t = await createTestDb(); db = t.db; close = t.close;
  setTransportFactory(() => ({ sendMail: vi.fn(async (m: any) => { sent.push(m); }) }) as any);
});
afterAll(async () => { setTransportFactory(null); await closeBrowser(); await close(); });
beforeEach(async () => { sent.length = 0; await truncateAll(db); });

async function setupUserWithSmtp() {
  const u = await createCaller(createTestContext(db)).auth.register({ username: 'jozef', password: 'password123' });
  const caller = createCaller(createTestContext(db, u.id));
  await caller.settings.update({
    smtpHost: 'smtp.example.com', smtpPort: 465, smtpUser: 'jozef@example.com',
    smtpSecure: true, emailFrom: 'jozef@example.com', supplierName: 'Ján Testovací',
  });
  await caller.settings.setSmtpPassword({ password: 'tajne' });
  return caller;
}

describe('invoices.sendEmail', () => {
  it('sends pdf attachment to customer + cc and sets sentAt', async () => {
    const caller = await setupUserWithSmtp();
    const { id } = await caller.invoices.create({
      number: '20260001', customerName: 'Test s.r.o.', customerEmail: 'billing@example.com',
      customerCcEmails: ['cc@example.com'], issueDate: '2026-01-10', dueDate: '2026-01-24',
      deliveryDate: '2026-01-10', items: [{ description: 'X', quantity: 1, unitPrice: 100, vatRate: 0 }],
    });
    const res = await caller.invoices.sendEmail({ id, subject: 'Faktúra 20260001', body: 'V prílohe faktúra.' });
    expect(res.sentAt).toBeTruthy();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toEqual(['billing@example.com']);
    expect(sent[0].cc).toEqual(['cc@example.com']);
    expect(sent[0].attachments[0].filename).toBe('faktura-20260001.pdf');
    expect(sent[0].attachments[0].content.subarray(0, 5).toString()).toBe('%PDF-');
    const { invoice } = await caller.invoices.get({ id });
    expect(invoice.sentAt).not.toBeNull();
  }, 60000);

  it('fails with PRECONDITION_FAILED when customer has no email', async () => {
    const caller = await setupUserWithSmtp();
    const { id } = await caller.invoices.create({
      number: '20260002', customerName: 'Bez Emailu s.r.o.', issueDate: '2026-01-10',
      dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      items: [{ description: 'X', quantity: 1, unitPrice: 100, vatRate: 0 }],
    });
    await expect(caller.invoices.sendEmail({ id, subject: 's', body: 'b' }))
      .rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });
  });

  it('fails when smtp not configured; sentAt stays null on transport error', async () => {
    const u = await createCaller(createTestContext(db)).auth.register({ username: 'nosmtp', password: 'password123' });
    const caller = createCaller(createTestContext(db, u.id));
    const { id } = await caller.invoices.create({
      number: '20260001', customerName: 'X', customerEmail: 'a@example.com',
      issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      items: [{ description: 'Y', quantity: 1, unitPrice: 1, vatRate: 0 }],
    });
    await expect(caller.invoices.sendEmail({ id, subject: 's', body: 'b' }))
      .rejects.toMatchObject({ code: 'PRECONDITION_FAILED' });

    const smtpCaller = await setupUserWithSmtp();
    const { id: id2 } = await smtpCaller.invoices.create({
      number: '20260009', customerName: 'X', customerEmail: 'a@example.com',
      issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
      items: [{ description: 'Y', quantity: 1, unitPrice: 1, vatRate: 0 }],
    });
    setTransportFactory(() => ({ sendMail: vi.fn(async () => { throw new Error('boom'); }) }) as any);
    await expect(smtpCaller.invoices.sendEmail({ id: id2, subject: 's', body: 'b' })).rejects.toThrow();
    const { invoice } = await smtpCaller.invoices.get({ id: id2 });
    expect(invoice.sentAt).toBeNull();
    setTransportFactory(() => ({ sendMail: vi.fn(async (m: any) => { sent.push(m); }) }) as any);
  }, 60000);
});
