import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

// Intl puts no-break spaces between groups and before the symbol.
const plain = (s: string) => s.replace(/\s/g, ' ');

describe('formatMoney', () => {
  it('formats in Slovak with the currency symbol', () => {
    expect(plain(formatMoney(1500))).toBe('1 500,00 €');
    expect(plain(formatMoney(70.5, 'CZK'))).toBe('70,50 CZK');
  });

  it('falls back to the code for an unknown currency', () => {
    expect(plain(formatMoney(1500, 'XX'))).toBe('1 500,00 XX');
  });
});
