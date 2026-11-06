/** Money in Slovak format, e.g. "1 500,00 €"; an unknown currency code is appended as is. */
export const formatMoney = (n: number, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('sk-SK', { style: 'currency', currency }).format(n);
  } catch {
    return (
      new Intl.NumberFormat('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) +
      ' ' +
      currency
    );
  }
};
