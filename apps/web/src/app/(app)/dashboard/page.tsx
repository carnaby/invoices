'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { InvoiceTable } from '@/components/invoice-table';
import { Card, PageHeader, Select, StatTile } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Máj', 'Jún', 'Júl', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

export default function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const stats = trpc.dashboard.stats.useQuery({ year });

  const yearOptions = useMemo(() => {
    const years = new Set(stats.data?.years ?? []);
    years.add(currentYear);
    return Array.from(years).sort((a, b) => b - a);
  }, [stats.data?.years, currentYear]);

  const monthly = stats.data?.monthly ?? Array(12).fill(0);
  const maxMonthly = Math.max(...monthly);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        action={
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
        }
      />

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          data-testid="stat-invoiced"
          label="Fakturované"
          value={formatMoney(stats.data?.invoicedTotal ?? 0)}
        />
        <StatTile
          data-testid="stat-paid"
          label="Uhradené"
          value={formatMoney(stats.data?.paidTotal ?? 0)}
          tone="success"
        />
        <StatTile
          data-testid="stat-unpaid"
          label="Neuhradené"
          value={formatMoney(stats.data?.unpaidTotal ?? 0)}
        />
        <StatTile
          data-testid="stat-overdue"
          label={`Po splatnosti (${stats.data?.overdueCount ?? 0})`}
          value={formatMoney(stats.data?.overdueTotal ?? 0)}
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
                    title={formatMoney(amount)}
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
