import { describe, expect, it } from 'vitest';
import { derivePaymentStatus, isOverdue } from './status';

describe('derivePaymentStatus', () => {
  it.each([
    [100, 0, 'unpaid'],
    [100, 50, 'partial'],
    [100, 100, 'paid'],
    [100, 150, 'paid'],
    [0, 0, 'paid'],
  ])('total=%d paid=%d → %s', (total, paid, expected) => {
    expect(derivePaymentStatus(total, paid)).toBe(expected);
  });
});

describe('isOverdue', () => {
  it('true when due before today and not paid', () => {
    expect(isOverdue('2026-06-14', 'unpaid', '2026-07-06')).toBe(true);
    expect(isOverdue('2026-06-14', 'partial', '2026-07-06')).toBe(true);
  });
  it('false when paid or due today/future', () => {
    expect(isOverdue('2026-06-14', 'paid', '2026-07-06')).toBe(false);
    expect(isOverdue('2026-07-06', 'unpaid', '2026-07-06')).toBe(false);
    expect(isOverdue('2026-08-01', 'unpaid', '2026-07-06')).toBe(false);
  });
});
