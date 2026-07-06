'use client';
import { useState } from 'react';
import { Button, Field, Input } from '@/components/ui';
import { todayIso } from '@/lib/format';
import { trpc } from '@/lib/trpc';

function parseAmount(v: string): number {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

export function MarkPaidDialog({
  invoiceId,
  total,
  paidAmount,
  onClose,
}: {
  invoiceId: string;
  total: number;
  paidAmount: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const remaining = Math.max(0, Math.round((total - paidAmount) * 100) / 100);
  const [amount, setAmount] = useState(String(remaining));
  const [date, setDate] = useState(todayIso());

  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      utils.invoices.get.invalidate({ id: invoiceId });
      utils.invoices.list.invalidate();
      onClose();
    },
  });

  const handleConfirm = () => {
    markPaid.mutate({ id: invoiceId, paidAmount: parseAmount(amount), paidDate: date || undefined });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold tracking-tight">Označiť úhradu</h2>
        <div className="mt-4 space-y-4">
          <Field label="Suma úhrady">
            <Input data-testid="paid-amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Dátum úhrady">
            <Input
              data-testid="paid-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Button
            type="button"
            variant="secondary"
            data-testid="pay-full"
            onClick={() => setAmount(String(total))}
          >
            Uhradiť v plnej výške
          </Button>
        </div>
        {markPaid.error && <p className="mt-3 text-xs text-[#ff3b30]">{markPaid.error.message}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-testid="cancel" onClick={onClose}>
            Zrušiť
          </Button>
          <Button
            type="button"
            data-testid="confirm"
            onClick={handleConfirm}
            disabled={markPaid.isPending}
          >
            Potvrdiť
          </Button>
        </div>
      </div>
    </div>
  );
}
