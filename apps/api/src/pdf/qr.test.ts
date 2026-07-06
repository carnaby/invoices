import { describe, expect, it } from 'vitest';
import { buildPayBySquareText, buildQrDataUrl } from './qr';

describe('pay by square', () => {
  it('encodes payment into non-empty bysquare string', () => {
    const text = buildPayBySquareText({
      iban: 'SK3112000000198742637541', amount: 290, currency: 'EUR',
      variableSymbol: '20260001', constantSymbol: '0308', beneficiaryName: 'Ján Testovací',
    });
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(20);
  });
  it('renders QR png data url', async () => {
    const url = await buildQrDataUrl('test-payload');
    expect(url).toMatch(/^data:image\/png;base64,/);
  });
});
