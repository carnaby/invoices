'use client';
import { useParams, useRouter } from 'next/navigation';
import type { ContactInput } from '@invoices/shared';
import { ContactForm } from '@/components/contact-form';
import { InvoiceTable } from '@/components/invoice-table';
import { Card, PageHeader } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function EditContactPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();

  const contact = trpc.contacts.get.useQuery({ id });
  const invoices = trpc.invoices.list.useQuery(
    { search: contact.data?.companyName ?? '' },
    { enabled: !!contact.data?.companyName },
  );
  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      router.push('/contacts');
    },
  });

  if (contact.isLoading || !contact.data) return null;

  return (
    <div>
      <PageHeader title={contact.data.companyName} />
      <ContactForm
        initial={contact.data}
        onSubmit={(data: ContactInput) => update.mutate({ id, data })}
        submitting={update.isPending}
      />

      <Card className="mt-8">
        <h2 className="mb-4 text-lg font-semibold tracking-tight">Faktúry kontaktu</h2>
        <InvoiceTable invoices={invoices.data?.invoices ?? []} />
      </Card>
    </div>
  );
}
