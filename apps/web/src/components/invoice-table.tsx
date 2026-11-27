import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import { StatusBadge } from './status-badge';
import { cn, EmptyState } from './ui';

// Mirrors the shape of `dashboard.stats().recent` / `invoices.list().invoices` items.
// Written out explicitly (rather than inferred via `inferRouterOutputs`) so this app
// doesn't need '@trpc/server' as a direct dependency just for a type import.
export type InvoiceListItem = {
  id: string;
  number: string;
  customerName: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  paidAmount: number;
  sentAt: Date | null;
  total: number;
  status: 'paid' | 'partial' | 'unpaid';
  overdue: boolean;
};

// One DOM for every width (e2e test ids must stay unique): a two-line card on
// phones, table columns from `md` up. Cells are placed explicitly on phones and
// flow in DOM order on desktop. Each invoice is one link in a list, so screen readers
// announce it as a link; the column labels are visual only.
const desktopCols = 'md:grid-cols-[7.5rem_minmax(0,1fr)_6.5rem_6.5rem_9rem_9.5rem] md:gap-x-4';
const desktopCell = 'md:col-span-1 md:col-start-auto md:row-start-auto';

export function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) return <EmptyState>Zatiaľ žiadne faktúry.</EmptyState>;
  return (
    <div className="text-sm">
      <div
        aria-hidden="true"
        className={cn(
          'hidden border-b border-line pb-3 text-xs font-medium uppercase tracking-wide text-muted md:grid',
          desktopCols,
        )}
      >
        <span>Číslo</span>
        <span>Odberateľ</span>
        <span>Vystavená</span>
        <span>Splatná</span>
        <span className="text-right">Suma</span>
        <span>Stav</span>
      </div>
      <ul className="divide-y divide-line">
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            <Link
              href={`/invoices/${invoice.id}`}
              data-testid={`invoice-row-${invoice.number}`}
              className={cn(
                'grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 transition',
                '-mx-4 px-4 active:bg-canvas sm:-mx-6 sm:px-6 md:mx-0 md:px-0 md:py-3.5 md:hover:bg-canvas/60',
                desktopCols,
              )}
            >
              <span className={cn('col-start-1 row-start-2 text-xs text-muted md:text-sm md:font-medium md:text-accent', desktopCell)}>
                {invoice.number}
              </span>
              <span className={cn('col-span-2 col-start-1 row-start-1 truncate font-medium text-ink md:font-normal', desktopCell)}>
                {invoice.customerName}
              </span>
              <span className={cn('hidden text-ink md:block', desktopCell)}>
                {formatDate(invoice.issueDate)}
              </span>
              <span className={cn('col-start-2 row-start-2 truncate text-xs text-muted md:text-sm md:text-ink', desktopCell)}>
                <span className="md:hidden">· splatná </span>
                {formatDate(invoice.dueDate)}
              </span>
              <span className={cn('col-start-3 row-start-1 text-right font-semibold tabular-nums md:font-normal', desktopCell)}>
                {formatMoney(invoice.total, invoice.currency)}
              </span>
              <span className={cn('col-start-3 row-start-2 justify-self-end md:justify-self-start', desktopCell)}>
                <StatusBadge status={invoice.status} overdue={invoice.overdue} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
