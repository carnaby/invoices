import { describe, expect, it } from 'vitest';
import { isDomesticCountry, showsSupplierIcDph } from './vat';

describe('isDomesticCountry', () => {
  it.each([null, undefined, '', '  ', 'Slovensko', 'Slovenská republika', 'slovenska republika', 'SK', 'Slovakia', ' slovensko '])(
    '%j is Slovakia',
    (country) => {
      expect(isDomesticCountry(country)).toBe(true);
    },
  );

  it.each(['Česká republika', 'CZ', 'Nemecko', 'Slovinsko', 'Slovenia', 'Slovenko'])('%j is abroad', (country) => {
    expect(isDomesticCountry(country)).toBe(false);
  });
});

describe('showsSupplierIcDph', () => {
  it('a VAT payer (§ 4) shows the IČ DPH on every invoice', () => {
    expect(showsSupplierIcDph('payer', 'Slovensko')).toBe(true);
    expect(showsSupplierIcDph('payer', 'Česká republika')).toBe(true);
  });

  it('a § 7 / § 7a registration shows it only to a customer outside Slovakia', () => {
    expect(showsSupplierIcDph('identified', 'Slovensko')).toBe(false);
    expect(showsSupplierIcDph('identified', null)).toBe(false);
    expect(showsSupplierIcDph('identified', 'Česká republika')).toBe(true);
  });
});
