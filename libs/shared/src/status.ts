export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type PaymentStatusFilter = PaymentStatus | 'overdue';

export function derivePaymentStatus(total: number, paidAmount: number): PaymentStatus {
  if (total <= 0 || paidAmount >= total) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function isOverdue(dueDate: string, status: PaymentStatus, today: string): boolean {
  return status !== 'paid' && dueDate < today; // YYYY-MM-DD strings compare lexicographically
}
