'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { InvoiceTable } from '@/components/invoice-table';
import { Card, PageHeader, Select, StatTile } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

const ZERO_BUCKET = {
  currency: 'EUR',
  invoicedTotal: 0,
  paidTotal: 0,
  unpaidTotal: 0,
  overdueTotal: 0,
  overdueCount: 0,
  monthly: Array(12).fill(0) as number[],
};

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [selectedCurrency, setSelectedCurrency] = useState<string | undefined>(undefined);
  const stats = trpc.dashboard.stats.useQuery({ year });

  const yearOptions = useMemo(() => {
    const years = new Set(stats.data?.years ?? []);
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [stats.data?.years, currentYear]);

  const byCurrency = stats.data?.byCurrency ?? [];
  const currencies = byCurrency.map((b) => b.currency);
  const activeCurrency =
    selectedCurrency && currencies.includes(selectedCurrency) ? selectedCurrency : currencies[0];
  const active = byCurrency.find((b) => b.currency === activeCurrency) ?? ZERO_BUCKET;

  const monthly = active.monthly;
  const maxMonthly = Math.max(...monthly);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        action={
          <div className="flex items-center gap-3">
            <Select
              data-testid="year-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            {currencies.length > 1 && (
              <Select
                data-testid="currency-select"
                value={activeCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          data-testid="stat-invoiced"
          label="Fakturované"
          value={formatMoney(active.invoicedTotal, active.currency)}
        />
        <StatTile
          data-testid="stat-paid"
          label="Uhradené"
          value={formatMoney(active.paidTotal, active.currency)}
          tone="success"
        />
        <StatTile
          data-testid="stat-unpaid"
          label="Neuhradené"
          value={formatMoney(active.unpaidTotal, active.currency)}
        />
        <StatTile
          data-testid="stat-overdue"
          label={`Po splatnosti (${active.overdueCount})`}
          value={formatMoney(active.overdueTotal, active.currency)}
          tone="danger"
        />
      </div>

      <Card className="mb-8">
        <h2 className="mb-6 text-sm font-medium text-[#6e6e73]">Fakturácia podľa mesiacov</h2>
        <div data-testid="monthly-chart" className="flex items-end gap-2 sm:gap-4">
          {monthly.map((amount, i) => {
            const h = maxMonthly === 0 ? 0 : Math.round((amount / maxMonthly) * 100);
            return (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end">
                  <div
                    title={formatMoney(amount, active.currency)}
                    className="w-full rounded-t-md bg-[#0071e3] transition-all"
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-xs text-[#6e6e73]">{MONTH_LABELS[i]}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Posledné faktúry</h2>
          <Link href="/invoices" className="text-sm font-medium text-[#0071e3] hover:underline">
            Všetky faktúry →
          </Link>
        </div>
        <InvoiceTable invoices={stats.data?.recent ?? []} />
      </Card>
    </div>
  );
}
