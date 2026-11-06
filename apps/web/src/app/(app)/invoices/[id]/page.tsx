'use client';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { calcItemTotals, derivePaymentStatus, isOverdue } from '@invoices/shared';
import { MarkPaidDialog } from '@/components/mark-paid-dialog';
import { SendEmailDialog } from '@/components/send-email-dialog';
import { StatusBadge } from '@/components/status-badge';
import {
  Badge,
  Button,
  buttonClasses,
  Card,
  CardTitle,
  CheckCircleIcon,
  ConfirmDialog,
  DownloadIcon,
  EditIcon,
  FileIcon,
  MailIcon,
  PageHeader,
  TrashIcon,
  UndoIcon,
} from '@/components/ui';
import { formatDate, formatMoney, todayIso } from '@/lib/format';
import { apiUrl, trpc } from '@/lib/trpc';

type DialogState = 'none' | 'markPaid' | 'sendEmail' | 'delete' | 'resetPayments';

const LOCK_BADGE = {
  idoklad: {
    label: 'Uzamknutá · z iDokladu',
    title: 'Faktúra bola prenesená z iDokladu a nedá sa meniť ani zmazať. Úhrady sa zapisujú ďalej.',
  },
  paid: {
    label: 'Uzamknutá · uhradená',
    title: 'Uhradená faktúra sa nedá meniť ani zmazať. Po zrušení úhrad sa odomkne.',
  },
} as const;

const ITEM_COLS =
  'md:grid-cols-[minmax(0,1fr)_5rem_3rem_7rem_4.5rem_7rem_6rem_7rem] md:gap-x-4';

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
    // The invoice may have been locked meanwhile: reload so the page shows the lock.
    onError: () => utils.invoices.get.invalidate({ id }),
  });

  const resetPayments = trpc.invoices.resetPayments.useMutation({
    onSuccess: () => {
      utils.invoices.get.invalidate({ id });
      utils.invoices.list.invalidate();
      setDialog('none');
    },
  });

  if (query.isLoading || !query.data) return null;

  const { invoice, items, totals, locked, lockReason, hasOriginal } = query.data;
  const settings = settingsQuery.data;
  const status = derivePaymentStatus(totals.total, invoice.paidAmount);
  const overdue = isOverdue(invoice.dueDate, status, todayIso());

  return (
    <div>
      <PageHeader
        title={`Faktúra ${invoice.number}`}
        meta={
          <>
            <StatusBadge status={status} overdue={overdue} />
            {lockReason && (
              <Badge tone="neutral" data-testid="locked-badge" title={LOCK_BADGE[lockReason].title}>
                {LOCK_BADGE[lockReason].label}
              </Badge>
            )}
            {invoice.sentAt && (
              <Badge tone="blue" data-testid="sent-info">
                Odoslaná {new Date(invoice.sentAt).toLocaleDateString('sk-SK')}
              </Badge>
            )}
            {status !== 'unpaid' && (
              <span data-testid="paid-info" className="text-sm text-muted">
                {status === 'paid'
                  ? `Uhradené${invoice.paidDate ? ' ' + formatDate(invoice.paidDate) : ''}`
                  : `Uhradené ${formatMoney(invoice.paidAmount, invoice.currency)} z ${formatMoney(totals.total, invoice.currency)}`}
              </span>
            )}
          </>
        }
        action={
          // Phone: a 2-column grid of full-width buttons. Desktop: one wrapping row.
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <a
              data-testid="download-pdf"
              href={`${apiUrl}/files/invoices/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses('secondary')}
            >
              <DownloadIcon size={18} />
              Stiahnuť PDF
            </a>
            {hasOriginal && (
              <a
                data-testid="download-original"
                href={`${apiUrl}/files/invoices/${id}/original`}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses('secondary')}
              >
                <FileIcon size={18} />
                Originál z iDokladu
              </a>
            )}
            <Button variant="secondary" data-testid="send-email" onClick={() => setDialog('sendEmail')}>
              <MailIcon size={18} />
              <span className="sm:hidden">E-mail</span>
              <span className="max-sm:hidden">Odoslať e-mailom</span>
            </Button>
            <Button variant="secondary" data-testid="mark-paid" onClick={() => setDialog('markPaid')}>
              <CheckCircleIcon size={18} />
              Označiť úhradu
            </Button>
            {invoice.paidAmount > 0 && (
              <Button variant="secondary" data-testid="reset-payments" onClick={() => setDialog('resetPayments')}>
                <UndoIcon size={18} />
                Zrušiť úhrady
              </Button>
            )}
            {!locked && (
              <>
                <Link href={`/invoices/${id}/edit`} data-testid="edit-invoice" className={buttonClasses('primary')}>
                  <EditIcon size={18} />
                  Upraviť
                </Link>
                <Button variant="danger" data-testid="delete-invoice" onClick={() => setDialog('delete')}>
                  <TrashIcon size={18} />
                  Zmazať
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 sm:mb-6 sm:grid-cols-2 sm:gap-6">
        <Card>
          <CardTitle className="sm:mb-4">Dodávateľ</CardTitle>
          <div className="space-y-1 text-sm text-ink">
            <p className="font-medium">{settings?.supplierName || '—'}</p>
            {settings?.supplierStreet && <p>{settings.supplierStreet}</p>}
            {(settings?.supplierZip || settings?.supplierCity) && (
              <p>{[settings?.supplierZip, settings?.supplierCity].filter(Boolean).join(' ')}</p>
            )}
            {settings?.supplierCountry && <p>{settings.supplierCountry}</p>}
            {idLine(settings?.supplierIco, settings?.supplierDic, settings?.supplierIcDph) && (
              <p className="pt-1 text-muted">
                {idLine(settings?.supplierIco, settings?.supplierDic, settings?.supplierIcDph)}
              </p>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle className="sm:mb-4">Odberateľ</CardTitle>
          <div className="space-y-1 text-sm text-ink">
            <p className="font-medium">{invoice.customerName}</p>
            {invoice.customerStreet && <p>{invoice.customerStreet}</p>}
            {(invoice.customerZip || invoice.customerCity) && (
              <p>{[invoice.customerZip, invoice.customerCity].filter(Boolean).join(' ')}</p>
            )}
            {invoice.customerCountry && <p>{invoice.customerCountry}</p>}
            {idLine(invoice.customerIco, invoice.customerDic, invoice.customerIcDph) && (
              <p className="pt-1 text-muted">
                {idLine(invoice.customerIco, invoice.customerDic, invoice.customerIcDph)}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card className="mb-4 sm:mb-6">
        <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3 sm:gap-6">
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
            <p className="break-words">{settings?.iban || '—'}</p>
            {settings?.swift && <p>SWIFT/BIC: {settings.swift}</p>}
          </div>
        </div>
      </Card>

      <Card className="mb-4 sm:mb-6">
        <CardTitle className="sm:mb-4">Položky</CardTitle>
        {/* One DOM: a card per item on phones, table columns from md up. */}
        <div role="table" className="text-sm">
          <div
            role="row"
            className={`hidden border-b border-line pb-3 text-xs font-medium uppercase tracking-wide text-muted md:grid ${ITEM_COLS}`}
          >
            <span role="columnheader">Popis</span>
            <span role="columnheader" className="text-right">Množstvo</span>
            <span role="columnheader">MJ</span>
            <span role="columnheader" className="text-right">Cena/j</span>
            <span role="columnheader" className="text-right">DPH %</span>
            <span role="columnheader" className="text-right">Základ</span>
            <span role="columnheader" className="text-right">DPH</span>
            <span role="columnheader" className="text-right">Spolu</span>
          </div>
          <div className="divide-y divide-line">
            {items.map((item) => {
              const t = calcItemTotals({
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                vatRate: item.vatRate,
              });
              return (
                <div
                  key={item.id}
                  role="row"
                  className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 py-3 md:items-center md:py-3.5 ${ITEM_COLS}`}
                >
                  <span role="cell" className="col-span-2 break-words md:col-span-1">
                    {item.description}
                  </span>
                  <span role="cell" className="text-xs text-muted tabular-nums md:hidden">
                    {item.quantity} {item.unit} × {formatMoney(item.unitPrice, invoice.currency)}
                    {item.vatRate > 0 && ` · DPH ${item.vatRate} %`}
                  </span>
                  <span role="cell" className="hidden text-right tabular-nums md:block">{item.quantity}</span>
                  <span role="cell" className="hidden md:block">{item.unit}</span>
                  <span role="cell" className="hidden text-right tabular-nums md:block">
                    {formatMoney(item.unitPrice, invoice.currency)}
                  </span>
                  <span role="cell" className="hidden text-right tabular-nums md:block">{item.vatRate} %</span>
                  <span role="cell" className="hidden text-right tabular-nums md:block">
                    {formatMoney(t.base, invoice.currency)}
                  </span>
                  <span role="cell" className="hidden text-right tabular-nums md:block">
                    {formatMoney(t.vat, invoice.currency)}
                  </span>
                  <span role="cell" className="text-right font-medium tabular-nums md:font-normal">
                    {formatMoney(t.total, invoice.currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row">
          {totals.vatSummary.length > 0 && (
            <div className="w-full text-sm sm:max-w-sm">
              <table className="w-full tabular-nums">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-wide text-muted">
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
          <div className="flex w-full flex-col gap-2 text-sm tabular-nums sm:ml-auto sm:max-w-xs">
            <div className="flex justify-between">
              <span className="text-muted">Základ dane</span>
              <span data-testid="totals-base">{formatMoney(totals.base, invoice.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">DPH</span>
              <span data-testid="totals-vat">{formatMoney(totals.vat, invoice.currency)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
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
          currency={invoice.currency}
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
        onCancel={() => {
          remove.reset();
          setDialog('none');
        }}
        error={remove.error?.message}
        pending={remove.isPending}
      />
      <ConfirmDialog
        open={dialog === 'resetPayments'}
        title="Zrušiť úhrady?"
        description={`Uhradená suma ${formatMoney(invoice.paidAmount, invoice.currency)} sa vynuluje.${
          lockReason === 'paid' ? ' Faktúra sa tým odomkne.' : ''
        }`}
        confirmLabel="Zrušiť úhrady"
        onConfirm={() => resetPayments.mutate({ id })}
        onCancel={() => {
          resetPayments.reset();
          setDialog('none');
        }}
        error={resetPayments.error?.message}
        pending={resetPayments.isPending}
      />
    </div>
  );
}
