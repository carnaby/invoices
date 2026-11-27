/**
 * How the supplier's IČ DPH was assigned: `payer` = VAT payer under § 4 of the VAT Act, `identified` = registered
 * under § 7 / § 7a (e.g. for services to businesses in other EU states) without being a VAT payer.
 */
export const VAT_REGISTRATIONS = ['identified', 'payer'] as const;
export type VatRegistration = (typeof VAT_REGISTRATIONS)[number];

const SLOVAKIA = new Set(['', 'slovensko', 'slovenska republika', 'sk', 'svk', 'slovakia', 'slovak republic']);

/** The country is free text; an empty one counts as Slovakia. */
export function isDomesticCountry(country: string | null | undefined): boolean {
  const normalized = (country ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase();
  return SLOVAKIA.has(normalized);
}

/**
 * An IČ DPH assigned under § 7 / § 7a is not used for domestic supplies (FR SR, eFaktúra FAQ, Príklad č. 90),
 * so it is printed only for a customer outside Slovakia. A VAT payer prints it on every invoice.
 */
export function showsSupplierIcDph(registration: VatRegistration, customerCountry: string | null | undefined) {
  return registration === 'payer' || !isDomesticCountry(customerCountry);
}
