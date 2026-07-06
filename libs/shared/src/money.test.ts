import { describe, expect, it } from 'vitest';
import { calcInvoiceTotals, calcItemTotals, round2 } from './money';

describe('round2', () => {
  it('rounds half-up to 2 decimals', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.004)).toBe(2.0);
    expect(round2(2.675)).toBe(2.68); // classic float trap — must use big.js, not Math.round
    expect(round2(3024)).toBe(3024);
  });
});

describe('calcItemTotals', () => {
  it('computes base, vat, total with per-line rounding', () => {
    expect(calcItemTotals({ quantity: 1, unitPrice: 3024, vatRate: 0 })).toEqual({
      base: 3024, vat: 0, total: 3024,
    });
    expect(calcItemTotals({ quantity: 3, unitPrice: 33.335, vatRate: 20 })).toEqual({
      base: 100.01, vat: 20, total: 120.01, // base=100.005→100.01 (half-up); vat=20.002→20.00
    });
    expect(calcItemTotals({ quantity: 0.5, unitPrice: 99.99, vatRate: 23 })).toEqual({
      base: 50.0, vat: 11.5, total: 61.5, // 49.995→50.00; 11.5
    });
  });
});

describe('calcInvoiceTotals', () => {
  it('sums items and groups VAT summary by rate (ordered asc)', () => {
    const totals = calcInvoiceTotals([
      { quantity: 1, unitPrice: 100, vatRate: 20 },
      { quantity: 2, unitPrice: 50, vatRate: 20 },
      { quantity: 1, unitPrice: 10, vatRate: 0 },
    ]);
    expect(totals).toEqual({
      base: 210, vat: 40, total: 250,
      vatSummary: [
        { vatRate: 0, base: 10, vat: 0, total: 10 },
        { vatRate: 20, base: 200, vat: 40, total: 240 },
      ],
    });
  });
  it('handles empty list', () => {
    expect(calcInvoiceTotals([])).toEqual({ base: 0, vat: 0, total: 0, vatSummary: [] });
  });
});
