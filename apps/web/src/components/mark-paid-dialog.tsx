'use client';
import { useState } from 'react';
import { Button, Field, Input, Sheet } from '@/components/ui';
import { round2 } from '@invoices/shared';
import { formatMoney, todayIso } from '@/lib/format';
import { trpc } from '@/lib/trpc';

function parseAmount(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Records one received payment; the amount is added to what is already paid. */
export function MarkPaidDialog({
  invoiceId,
  total,
  paidAmount,
  currency,
  onClose,
}: {
  invoiceId: string;
  total: number;
  paidAmount: number;
  currency: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayIso());

  const addPayment = trpc.invoices.addPayment.useMutation({
    onSuccess: () => {
      utils.invoices.get.invalidate({ id: invoiceId });
      utils.invoices.list.invalidate();
      onClose();
    },
    // The server refused, e.g. another tab paid meanwhile: reload so the dialog checks the real remainder.
    onError: () => utils.invoices.get.invalidate({ id: invoiceId }),
  });

  const value = parseAmount(amount);
  // Same rule as the API: a payment cannot exceed what is left to pay.
  const tooHigh = Math.round(round2(value) * 100) > Math.round(remaining * 100);
  const handleConfirm = () => {
    addPayment.mutate({ id: invoiceId, amount: value, paidDate: date || undefined });
  };

  return (
    <Sheet
      title="Pridať úhradu"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" data-testid="cancel" onClick={onClose}>
            Zrušiť
          </Button>
          <Button
            type="button"
            data-testid="confirm"
            onClick={handleConfirm}
            disabled={addPayment.isPending || value <= 0 || tooHigh}
          >
            Potvrdiť
          </Button>
        </>
      }
    >
      <p data-testid="already-paid" className="mt-2 text-sm text-muted">
        Už uhradené {formatMoney(paidAmount, currency)} z {formatMoney(total, currency)}
      </p>
      <div className="mt-4 space-y-4">
        <Field label="Prijatá platba">
          <Input
            data-testid="paid-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        {tooHigh && (
          <p data-testid="paid-amount-error" className="-mt-2 text-xs text-danger">
            Úhrada presahuje zostávajúcu sumu {formatMoney(remaining, currency)}.
          </p>
        )}
        <Field label="Dátum úhrady">
          <Input data-testid="paid-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-auto"
          data-testid="pay-full"
          onClick={() => setAmount(String(remaining))}
          disabled={remaining <= 0}
        >
          {paidAmount > 0 ? 'Doplatiť zvyšok' : 'Uhradiť v plnej výške'}
        </Button>
      </div>
      {remaining <= 0 && <p className="mt-3 text-xs text-muted">Faktúra je už uhradená celá.</p>}
      {addPayment.error && <p className="mt-3 text-xs text-danger">{addPayment.error.message}</p>}
    </Sheet>
  );
}
