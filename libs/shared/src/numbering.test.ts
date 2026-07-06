import { describe, expect, it } from 'vitest';
import { suggestInvoiceNumber } from './numbering';

describe('suggestInvoiceNumber', () => {
  it('starts at 0001 for empty year', () => {
    expect(suggestInvoiceNumber(2026, [])).toBe('20260001');
  });
  it('increments max in the same year, ignores other years and foreign formats', () => {
    expect(suggestInvoiceNumber(2026, ['20260001', '20260007', '20250099', 'ABC', '2026007'])).toBe(
      '20260008',
    );
  });
  it('pads to 4 digits and grows beyond 9999 without breaking', () => {
    expect(suggestInvoiceNumber(2026, ['20260012'])).toBe('20260013');
    expect(suggestInvoiceNumber(2026, ['20269999'])).toBe('202610000');
  });
});
