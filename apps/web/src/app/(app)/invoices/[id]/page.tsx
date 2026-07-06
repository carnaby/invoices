'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { calcItemTotals, derivePaymentStatus, isOverdue } from '@invoices/shared';
import { MarkPaidDialog } from '@/components/mark-paid-dialog';
import { SendEmailDialog } from '@/components/send-email-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Button, Card, ConfirmDialog, PageHeader, Table, TBody, Td, Th, THead, Tr } from '@/components/ui';
import { formatDate, formatMoney, todayIso } from '@/lib/format';
import { apiUrl, trpc } from '@/lib/trpc';

type DialogState = 'none' | 'markPaid' | 'sendEmail' | 'delete';

function idLine(ico?: string | null, dic?: string | null, icDph?: string | null): string {
  return [ico && `IČO: ${ico}`, dic && `DIČ: ${dic}`, icDph && `IČ DPH: ${icDph}`]
    .filter(Boolean)
    .join(' · ');
}

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const utils = trpc.useUtils();
  const [dialog, setDialog] = useState<DialogState>('none');

  const query = trpc.invoices.get.useQuery({ id });
  const settingsQuery = trpc.settings.get.useQuery();

  const remove = trpc.invoices.remove.useMutation({
    onSuccess: () => {
      utils.invoices.list.invalidate();
      router.push('/invoices');
    },
  });

  if (query.isLoading || !query.data) return null;

  const { invoice, items, totals } = query.data;
  const settings = settingsQuery.data;
  const status = derivePaymentStatus(totals.total, invoice.paidAmount);
  const overdue = isOverdue(invoice.dueDate, status, todayIso());

  return (
    <div>
      <PageHeader
        title={`Faktúra ${invoice.number}`}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <a
              data-testid="download-pdf"
              href={`${apiUrl}/files/invoices/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-[#e8e8ed] bg-white px-4 py-2.5 text-sm font-medium text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
            >
              Stiahnuť PDF
            </a>
            <Button variant="secondary" data-testid="send-email" onClick={() => setDialog('sendEmail')}>
              Odoslať e-mailom
            </Button>
            <Button variant="secondary" data-testid="mark-paid" onClick={() => setDialog('markPaid')}>
              Označiť úhradu
            </Button>
            <Link
              href={`/invoices/${id}/edit`}
              data-testid="edit-invoice"
              className="inline-flex items-center justify-center rounded-xl bg-[#0071e3] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0077ed]"
            >
              Upraviť
            </Link>
            <Button variant="danger" data-testid="delete-invoice" onClick={() => setDialog('delete')}>
              Zmazať
            </Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <StatusBadge status={status} overdue={overdue} />
        {status !== 'unpaid' && (
          <span data-testid="paid-info" className="text-sm text-[#6e6e73]">
            {status === 'paid'
              ? `Uhradené${invoice.paidDate ? ' ' + formatDate(invoice.paidDate) : ''}`
              : `Uhradené ${formatMoney(invoice.paidAmount, invoice.currency)} z ${formatMoney(totals.total, invoice.currency)}`}
          </span>
        )}
        {invoice.sentAt && (
          <span
            data-testid="sent-info"
            className="inline-flex items-center rounded-full bg-[#0071e3]/10 px-2.5 py-0.5 text-xs font-medium text-[#0071e3]"
          >
            Odoslaná {new Date(invoice.sentAt).toLocaleDateString('sk-SK')}
          </span>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Dodávateľ</h2>
          <div className="space-y-1 text-sm text-[#1d1d1f]">
            <p className="font-medium">{settings?.supplierName || '—'}</p>
            {settings?.supplierStreet && <p>{settings.supplierStreet}</p>}
            {(settings?.supplierZip || settings?.supplierCity) && (
              <p>{[settings?.supplierZip, settings?.supplierCity].filter(Boolean).join(' ')}</p>
            )}
            {settings?.supplierCountry && <p>{settings.supplierCountry}</p>}
            {idLine(settings?.supplierIco, settings?.supplierDic, settings?.supplierIcDph) && (
              <p className="pt-1 text-[#6e6e73]">
                {idLine(settings?.supplierIco, settings?.supplierDic, settings?.supplierIcDph)}
              </p>
            )}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Odberateľ</h2>
          <div className="space-y-1 text-sm text-[#1d1d1f]">
            <p className="font-medium">{invoice.customerName}</p>
            {invoice.customerStreet && <p>{invoice.customerStreet}</p>}
            {(invoice.customerZip || invoice.customerCity) && (
              <p>{[invoice.customerZip, invoice.customerCity].filter(Boolean).join(' ')}</p>
            )}
            {invoice.customerCountry && <p>{invoice.customerCountry}</p>}
            {idLine(invoice.customerIco, invoice.customerDic, invoice.customerIcDph) && (
              <p className="pt-1 text-[#6e6e73]">
                {idLine(invoice.customerIco, invoice.customerDic, invoice.customerIcDph)}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 gap-6 text-sm sm:grid-cols-3">
          <div>
            <h3 className="mb-2 font-semibold">Dátumy</h3>
            <p>Vystavenia: {formatDate(invoice.issueDate)}</p>
            <p>Splatnosti: {formatDate(invoice.dueDate)}</p>
            <p>Dodania: {formatDate(invoice.deliveryDate)}</p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Symboly</h3>
            <p>Variabilný symbol: {invoice.variableSymbol || '—'}</p>
            <p>Konštantný symbol: {invoice.constantSymbol || '—'}</p>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Bankový účet</h3>
            <p>{settings?.iban || '—'}</p>
            {settings?.swift && <p>SWIFT/BIC: {settings.swift}</p>}
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Položky</h2>
        <Table>
          <THead>
            <Tr>
              <Th>Popis</Th>
              <Th className="text-right">Množstvo</Th>
              <Th>MJ</Th>
              <Th className="text-right">Cena/j</Th>
              <Th className="text-right">DPH %</Th>
              <Th className="text-right">Základ</Th>
              <Th className="text-right">DPH</Th>
              <Th className="text-right">Spolu</Th>
            </Tr>
          </THead>
          <TBody>
            {items.map((item) => {
              const t = calcItemTotals({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate,
              });
              return (
                <Tr key={item.id}>
                  <Td>{item.description}</Td>
                  <Td className="text-right">{item.quantity}</Td>
                  <Td>{item.unit}</Td>
                  <Td className="text-right">{formatMoney(item.unitPrice, invoice.currency)}</Td>
                  <Td className="text-right">{item.vatRate} %</Td>
                  <Td className="text-right">{formatMoney(t.base, invoice.currency)}</Td>
                  <Td className="text-right">{formatMoney(t.vat, invoice.currency)}</Td>
                  <Td className="text-right">{formatMoney(t.total, invoice.currency)}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <Card>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
          {totals.vatSummary.length > 0 && (
            <div className="w-full max-w-sm text-sm">
              <table className="w-full">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
                    <th className="py-1 text-left">Sadzba DPH</th>
                    <th className="py-1 text-right">Základ</th>
                    <th className="py-1 text-right">DPH</th>
                    <th className="py-1 text-right">Spolu</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.vatSummary.map((row) => (
                    <tr key={row.vatRate}>
                      <td className="py-1">{row.vatRate} %</td>
                      <td className="py-1 text-right">{formatMoney(row.base, invoice.currency)}</td>
                      <td className="py-1 text-right">{formatMoney(row.vat, invoice.currency)}</td>
                      <td className="py-1 text-right">{formatMoney(row.total, invoice.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="ml-auto flex w-full max-w-xs flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">Základ dane</span>
              <span data-testid="totals-base">{formatMoney(totals.base, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#6e6e73]">DPH</span>
              <span data-testid="totals-vat">{formatMoney(totals.vat, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-[#e8e8ed] pt-2 text-base font-semibold">
              <span>Spolu</span>
              <span data-testid="totals-total">{formatMoney(totals.total, invoice.currency)}</span>
            </div>
          </div>
        </div>
      </Card>

      {dialog === 'markPaid' && (
        <MarkPaidDialog
          invoiceId={id}
          total={totals.total}
          paidAmount={invoice.paidAmount}
          onClose={() => setDialog('none')}
        />
      )}
      {dialog === 'sendEmail' && (
        <SendEmailDialog
          invoiceId={id}
          number={invoice.number}
          to={invoice.customerEmail}
          cc={invoice.customerCcEmails}
          supplierName={settings?.supplierName ?? ''}
          onClose={() => setDialog('none')}
        />
      )}
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Zmazať faktúru?"
        description={`Faktúra ${invoice.number} bude natrvalo odstránená.`}
        confirmLabel="Zmazať"
        onConfirm={() => remove.mutate({ id })}
        onCancel={() => setDialog('none')}
      />
    </div>
  );
}
