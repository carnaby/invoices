'use client';
import { InvoiceForm } from '@/components/invoice-form';
import { PageHeader } from '@/components/ui';

export default function NewInvoicePage() {
  return (
    <div>
      <PageHeader title="Nová faktúra" />
      <InvoiceForm />
    </div>
  );
}
