'use client';
import Link from 'next/link';
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

  if (query.data.lockReason) {
    return (
      <div>
        <PageHeader title={`Faktúra ${query.data.invoice.number}`} />
        <p data-testid="locked-message" className="text-sm text-[#1d1d1f]">
          {query.data.lockReason === 'idoklad'
            ? 'Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.'
            : 'Uhradená faktúra je uzamknutá a nedá sa meniť ani zmazať. Odomkne sa po zrušení úhrad.'}{' '}
          <Link href={`/invoices/${id}`} className="text-[#0071e3] hover:underline">
            Späť na faktúru
          </Link>
        </p>
      </div>
    );
  }

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
