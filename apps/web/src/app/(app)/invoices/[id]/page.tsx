'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const query = trpc.invoices.get.useQuery({ id });

  if (query.isLoading || !query.data) return null;

  return (
    <div>
      <PageHeader
        title={`Faktúra ${query.data.invoice.number}`}
        action={
          <Link
            href={`/invoices/${id}/edit`}
            data-testid="edit-invoice"
            className="inline-flex items-center justify-center rounded-xl bg-[#0071e3] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0077ed]"
          >
            Upraviť
          </Link>
        }
      />
    </div>
  );
}
