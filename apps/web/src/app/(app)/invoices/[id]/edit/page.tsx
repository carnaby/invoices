'use client';
import { useParams } from 'next/navigation';
import type { InvoiceInput } from '@invoices/shared';
import { InvoiceForm } from '@/components/invoice-form';
import { PageHeader } from '@/components/ui';
import { trpc } from '@/lib/trpc';

export default function EditInvoicePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const query = trpc.invoices.get.useQuery({ id });

  if (query.isLoading || !query.data) return null;

  const { invoice, items } = query.data;
  const initial: InvoiceInput = {
    contactId: invoice.contactId,
    number: invoice.number,
    variableSymbol: invoice.variableSymbol,
    constantSymbol: invoice.constantSymbol,
    customerName: invoice.customerName,
    customerIco: invoice.customerIco,
    customerIcDph: invoice.customerIcDph,
    customerDic: invoice.customerDic,
    customerStreet: invoice.customerStreet,
    customerZip: invoice.customerZip,
    customerCity: invoice.customerCity,
    customerCountry: invoice.customerCountry,
    customerEmail: invoice.customerEmail,
    customerCcEmails: invoice.customerCcEmails,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    deliveryDate: invoice.deliveryDate,
    introText: invoice.introText,
    note: invoice.note,
    currency: invoice.currency,
    items: items.map((i) => ({
      description: i.description,
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: i.unitPrice,
      vatRate: i.vatRate,
    })),
  };

  return (
    <div>
      <PageHeader title={`Upraviť faktúru ${invoice.number}`} />
      <InvoiceForm initial={initial} invoiceId={id} />
    </div>
  );
}
