import Big from 'big.js';

export interface ItemAmountsInput { quantity: number; unitPrice: number; vatRate: number; }
export interface ItemTotals { base: number; vat: number; total: number; }
export interface VatSummaryRow { vatRate: number; base: number; vat: number; total: number; }
export interface InvoiceTotals { base: number; vat: number; total: number; vatSummary: VatSummaryRow[]; }

export function round2(n: number): number {
  return Number(new Big(n).round(2, Big.roundHalfUp));
}

export function calcItemTotals(item: ItemAmountsInput): ItemTotals {
  const base = Number(new Big(item.quantity).times(item.unitPrice).round(2, Big.roundHalfUp));
  const vat = Number(new Big(base).times(item.vatRate).div(100).round(2, Big.roundHalfUp));
  return { base, vat, total: round2(base + vat) };
}

export function calcInvoiceTotals(items: ItemAmountsInput[]): InvoiceTotals {
  const byRate = new Map<number, { base: Big; vat: Big }>();
  let base = new Big(0);
  let vat = new Big(0);
  for (const item of items) {
    const t = calcItemTotals(item);
    base = base.plus(t.base);
    vat = vat.plus(t.vat);
    const row = byRate.get(item.vatRate) ?? { base: new Big(0), vat: new Big(0) };
    row.base = row.base.plus(t.base);
    row.vat = row.vat.plus(t.vat);
    byRate.set(item.vatRate, row);
  }
  const vatSummary = [...byRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([vatRate, r]) => ({
      vatRate,
      base: Number(r.base),
      vat: Number(r.vat),
      total: Number(r.base.plus(r.vat)),
    }));
  return { base: Number(base), vat: Number(vat), total: Number(base.plus(vat)), vatSummary };
}
