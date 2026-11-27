'use client';
import { useState } from 'react';
import { formatDate, formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';
import { Card, CardTitle, ConfirmDialog, TrashIcon, cn } from './ui';

export type Payment = { id: string; paidOn: string; amount: number };

const iconButtonBox = '-mr-1.5 rounded-lg p-2 md:p-1.5';

/** Takes the room of a row's delete button, so the totals line up with the payment amounts. */
function IconSpacer() {
  return (
    <span aria-hidden className="-mr-1.5 px-2 md:px-1.5">
      <span className="block w-[18px]" />
    </span>
  );
}

/** The payments received for an invoice, each one deletable; hidden while there are none. */
export function PaymentsCard({
  invoiceId,
  payments,
  paidAmount,
  total,
  currency,
}: {
  invoiceId: string;
  payments: Payment[];
  paidAmount: number;
  total: number;
  currency: string;
}) {
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<Payment | null>(null);
  const refresh = () => {
    utils.invoices.get.invalidate({ id: invoiceId });
    utils.invoices.list.invalidate();
  };
  const remove = trpc.invoices.deletePayment.useMutation({
    onSuccess: () => {
      refresh();
      setPending(null);
    },
    // The payment or the invoice may have changed meanwhile: reload what the page shows.
    onError: refresh,
  });

  if (payments.length === 0) return null;
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);

  return (
    <Card className="mt-4 sm:mt-6" data-testid="payments-card">
      <CardTitle className="sm:mb-4">Úhrady</CardTitle>
      <ul className="divide-y divide-line text-sm">
        {payments.map((p) => (
          <li key={p.id} data-testid="payment-row" className="flex items-center gap-3 py-2.5">
            <span className="flex-1 text-ink">{formatDate(p.paidOn)}</span>
            <span className="tabular-nums text-ink">{formatMoney(p.amount, currency)}</span>
            <button
              type="button"
              data-testid="delete-payment"
              aria-label="Zmazať úhradu"
              onClick={() => setPending(p)}
              className={cn(iconButtonBox, 'text-subtle transition hover:bg-danger/10 hover:text-danger')}
            >
              <TrashIcon size={18} />
            </button>
          </li>
        ))}
      </ul>
      <dl className="mt-3 space-y-1 border-t border-line pt-3 text-sm tabular-nums">
        <div className="flex items-center gap-3">
          <dt className="flex-1 text-muted">Spolu uhradené</dt>
          <dd data-testid="payments-paid" className="font-semibold text-ink">
            {formatMoney(paidAmount, currency)}
          </dd>
          <IconSpacer />
        </div>
        <div className="flex items-center gap-3">
          <dt className="flex-1 text-muted">Zostáva</dt>
          <dd data-testid="payments-remaining" className="text-ink">
            {formatMoney(remaining, currency)}
          </dd>
          <IconSpacer />
        </div>
      </dl>
      <ConfirmDialog
        open={pending !== null}
        title="Zmazať úhradu?"
        description={
          pending ? `Úhrada ${formatMoney(pending.amount, currency)} z ${formatDate(pending.paidOn)} sa zmaže.` : undefined
        }
        confirmLabel="Zmazať"
        onConfirm={() => pending && remove.mutate({ paymentId: pending.id })}
        onCancel={() => {
          remove.reset();
          setPending(null);
        }}
        error={remove.error?.message}
        pending={remove.isPending}
      />
    </Card>
  );
}
