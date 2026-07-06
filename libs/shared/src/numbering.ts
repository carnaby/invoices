export function suggestInvoiceNumber(year: number, existingNumbers: string[]): string {
  const prefix = String(year);
  const re = new RegExp(`^${prefix}(\\d{4,})$`);
  let max = 0;
  for (const n of existingNumbers) {
    const m = re.exec(n);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}
