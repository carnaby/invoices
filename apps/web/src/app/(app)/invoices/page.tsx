'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { InvoiceTable } from '@/components/invoice-table';
import { Button, Card, Input, PageHeader, Select, StatTile } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';

type StatusFilter = '' | 'paid' | 'partial' | 'unpaid' | 'overdue';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Všetky' },
  { value: 'paid', label: 'Uhradené' },
  { value: 'partial', label: 'Čiastočne uhradené' },
  { value: 'unpaid', label: 'Neuhradené' },
  { value: 'overdue', label: 'Po splatnosti' },
];

function invoiceCountLabel(n: number) {
  if (n === 1) return `${n} faktúra`;
  if (n >= 2 && n <= 4) return `${n} faktúry`;
  return `${n} faktúr`;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [year, setYear] = useState('');
  const [status, setStatus] = useState<StatusFilter>('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = trpc.invoices.list.useQuery({
    year: year ? Number(year) : undefined,
    status: status || undefined,
    search: debouncedSearch || undefined,
  });

  const invoices = list.data?.invoices ?? [];
  const summary = list.data?.summary ?? { count: 0, byCurrency: [] as { currency: string; total: number; unpaid: number }[] };
  const years = [...(list.data?.years ?? [])].sort((a, b) => b - a);

  const totalValue = summary.byCurrency.length
    ? summary.byCurrency.map((b) => formatMoney(b.total, b.currency))
    : [formatMoney(0)];
  const unpaidValue = summary.byCurrency.length
    ? summary.byCurrency.map((b) => formatMoney(b.unpaid, b.currency))
    : [formatMoney(0)];
  const hasUnpaid = summary.byCurrency.some((b) => b.unpaid > 0);

  return (
    <div>
      <PageHeader
        title="Faktúry"
        action={
          <Button
            data-testid="new-invoice"
            className="max-lg:hidden"
            onClick={() => router.push('/invoices/new')}
          >
            Nová faktúra
          </Button>
        }
      />

      <Card className="mb-4 sm:mb-6">
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
          <div className="col-span-2 sm:order-last sm:min-w-[220px] sm:flex-1">
            <Input
              label="Hľadať"
              type="search"
              data-testid="search"
              placeholder="Číslo alebo odberateľ…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="min-w-0 sm:w-48">
            <Select
              label="Rok"
              data-testid="year-filter"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="">Všetky roky</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-0 sm:w-56">
            <Select
              label="Stav"
              data-testid="status-filter"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-6">
        <StatTile
          data-testid="summary-count"
          className="max-sm:hidden"
          label="Počet faktúr"
          value={invoiceCountLabel(summary.count)}
        />
        <StatTile data-testid="summary-total" label="Spolu" value={totalValue} />
        <StatTile
          data-testid="summary-unpaid"
          label="Neuhradené"
          value={unpaidValue}
          tone={hasUnpaid ? 'danger' : 'default'}
        />
      </div>

      <Card>
        <p className="mb-1 text-xs font-medium text-muted sm:hidden">{invoiceCountLabel(summary.count)}</p>
        <InvoiceTable invoices={invoices} />
      </Card>
    </div>
  );
}
