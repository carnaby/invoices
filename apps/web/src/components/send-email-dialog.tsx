'use client';
import { useState } from 'react';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export function SendEmailDialog({
  invoiceId,
  number,
  to,
  cc,
  supplierName,
  onClose,
}: {
  invoiceId: string;
  number: string;
  to: string | null;
  cc: string[];
  supplierName: string;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState(`Faktúra ${number}`);
  const [body, setBody] = useState(
    `Dobrý deň,\n\nv prílohe Vám zasielam faktúru č. ${number}.\n\nS pozdravom\n${supplierName}`,
  );

  const sendEmail = trpc.invoices.sendEmail.useMutation({
    onSuccess: () => {
      utils.invoices.get.invalidate({ id: invoiceId });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        <h2 className="text-lg font-semibold tracking-tight">Odoslať e-mailom</h2>
        <div className="mt-4 space-y-4">
          <Field label="Komu">
            <Input value={to ?? ''} disabled />
          </Field>
          {cc.length > 0 && (
            <Field label="Kópia (CC)">
              <Input value={cc.join(', ')} disabled />
            </Field>
          )}
          <Field label="Predmet">
            <Input
              data-testid="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </Field>
          <Field label="Text správy">
            <Textarea
              data-testid="email-body"
              className="min-h-40"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
        </div>
        {sendEmail.error && (
          <p data-testid="email-error" className="mt-3 text-xs text-[#ff3b30]">
            {sendEmail.error.message}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" data-testid="cancel" onClick={onClose}>
            Zrušiť
          </Button>
          <Button
            type="button"
            data-testid="email-send"
            onClick={() => sendEmail.mutate({ id: invoiceId, subject, body })}
            disabled={sendEmail.isPending}
          >
            Odoslať
          </Button>
        </div>
      </div>
    </div>
  );
}
