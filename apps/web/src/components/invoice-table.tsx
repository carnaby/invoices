import Link from 'next/link';
import { formatDate, formatMoney } from '@/lib/format';
import { StatusBadge } from './status-badge';
import { Table, TBody, Td, Th, THead, Tr } from './ui';

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

export function InvoiceTable({ invoices }: { invoices: InvoiceListItem[] }) {
  if (invoices.length === 0) {
    return <p className="py-10 text-center text-sm text-[#6e6e73]">Zatiaľ žiadne faktúry.</p>;
  }
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Číslo</Th>
          <Th>Odberateľ</Th>
          <Th>Vystavená</Th>
          <Th>Splatná</Th>
          <Th className="text-right">Suma</Th>
          <Th>Stav</Th>
        </Tr>
      </THead>
      <TBody>
        {invoices.map((invoice) => (
          <Tr key={invoice.id} data-testid={`invoice-row-${invoice.number}`}>
            <Td>
              <Link href={`/invoices/${invoice.id}`} className="font-medium text-[#0071e3] hover:underline">
                {invoice.number}
              </Link>
            </Td>
            <Td>{invoice.customerName}</Td>
            <Td>{formatDate(invoice.issueDate)}</Td>
            <Td>{formatDate(invoice.dueDate)}</Td>
            <Td className="text-right">{formatMoney(invoice.total, invoice.currency)}</Td>
            <Td>
              <StatusBadge status={invoice.status} overdue={invoice.overdue} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}
