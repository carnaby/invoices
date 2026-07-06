'use client';
import { useRouter } from 'next/navigation';
import type { ContactInput } from '@invoices/shared';
import { ContactForm } from '@/components/contact-form';
import { PageHeader } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function NewContactPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const create = trpc.contacts.create.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      router.push('/contacts');
    },
  });

  return (
    <div>
      <PageHeader title="Nový kontakt" />
      <ContactForm onSubmit={(data: ContactInput) => create.mutate(data)} submitting={create.isPending} />
    </div>
  );
}
