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
  const summary = list.data?.summary ?? { count: 0, total: 0, unpaid: 0 };
  const years = [...(list.data?.years ?? [])].sort((a, b) => b - a);

  return (
    <div>
      <PageHeader
        title="Faktúry"
        action={
          <Button data-testid="new-invoice" onClick={() => router.push('/invoices/new')}>
            Nová faktúra
          </Button>
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-48">
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
          <div className="w-full sm:w-56">
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
          <div className="min-w-[220px] flex-1">
            <Input
              label="Hľadať"
              data-testid="search"
              placeholder="Hľadať podľa čísla alebo odberateľa…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatTile data-testid="summary-count" label="Počet faktúr" value={invoiceCountLabel(summary.count)} />
        <StatTile data-testid="summary-total" label="Spolu" value={formatMoney(summary.total)} />
        <StatTile
          data-testid="summary-unpaid"
          label="Neuhradené"
          value={formatMoney(summary.unpaid)}
          tone={summary.unpaid > 0 ? 'danger' : 'default'}
        />
      </div>

      <Card>
        <InvoiceTable invoices={invoices} />
      </Card>
    </div>
  );
}
