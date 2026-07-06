import { describe, expect, it } from 'vitest';
import {
  contactInputSchema, invoiceInputSchema, registerSchema, sendEmailSchema,
} from './schemas';

describe('registerSchema', () => {
  it('accepts valid, rejects short password and short username', () => {
    expect(registerSchema.safeParse({ username: 'jozef', password: '12345678' }).success).toBe(true);
    expect(registerSchema.safeParse({ username: 'jozef', password: '1234' }).success).toBe(false);
    expect(registerSchema.safeParse({ username: 'a', password: '12345678' }).success).toBe(false);
  });
});

describe('contactInputSchema', () => {
  it('requires companyName, defaults country and ccEmails', () => {
    const r = contactInputSchema.parse({ companyName: 'Test s.r.o.' });
    expect(r.country).toBe('Slovensko');
    expect(r.ccEmails).toEqual([]);
    expect(contactInputSchema.safeParse({}).success).toBe(false);
  });
  it('rejects invalid email in ccEmails', () => {
    expect(
      contactInputSchema.safeParse({ companyName: 'X', ccEmails: ['not-an-email'] }).success,
    ).toBe(false);
  });
});

describe('invoiceInputSchema', () => {
  const valid = {
    number: '20260001',
    customerName: 'Test s.r.o.',
    issueDate: '2026-01-10',
    dueDate: '2026-01-24',
    deliveryDate: '2026-01-10',
    items: [{ description: 'Práce', quantity: 1, unitPrice: 100, vatRate: 0 }],
  };
  it('accepts minimal valid invoice, fills defaults', () => {
    const r = invoiceInputSchema.parse(valid);
    expect(r.currency).toBe('EUR');
    expect(r.items[0].unit).toBe('ks');
  });
  it('rejects empty items and bad date format', () => {
    expect(invoiceInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(invoiceInputSchema.safeParse({ ...valid, issueDate: '10.1.2026' }).success).toBe(false);
  });
});

describe('sendEmailSchema', () => {
  it('requires uuid id, subject, body', () => {
    expect(
      sendEmailSchema.safeParse({ id: 'not-uuid', subject: 'x', body: 'y' }).success,
    ).toBe(false);
  });
});
