'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { InvoiceInput } from '@invoices/shared';
import { calcInvoiceTotals, calcItemTotals, invoiceInputSchema } from '@invoices/shared';
import { Button, Card, CardTitle, cn, Field, Input, PlusIcon, Select, TrashIcon } from '@/components/ui';
import { addDays, formatMoney, todayIso } from '@/lib/format';
import { trpc } from '@/lib/trpc';

const ITEM_COLS =
  'md:grid-cols-[minmax(0,1fr)_6rem_5rem_7rem_5rem_7.5rem_2.75rem] md:gap-x-3 md:gap-y-0';

/** Item input with a label on phones; from md up the column header names it. */
function ItemField({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-xs font-medium text-muted md:sr-only">{label}</span>
      {children}
    </label>
  );
}

type ItemRow = {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  vatRate: string;
};

type FormState = {
  contactId: string | null;
  number: string;
  variableSymbol: string;
  constantSymbol: string;
  customerName: string;
  customerIco: string;
  customerIcDph: string;
  customerDic: string;
  customerStreet: string;
  customerZip: string;
  customerCity: string;
  customerCountry: string;
  customerEmail: string;
  customerCcEmails: string;
  issueDate: string;
  dueDate: string;
  deliveryDate: string;
  introText: string;
  note: string;
  currency: string;
  items: ItemRow[];
};

const emptyItem = (): ItemRow => ({ description: '', quantity: '1', unit: 'ks', unitPrice: '', vatRate: '0' });

const parseNum = (v: string) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

// Cleared optional fields must serialize to `null`, not `undefined`: drizzle's
// `.set()` skips `undefined` columns entirely, so an `undefined` value would
// silently leave the previous saved value in place instead of clearing it.
const emptyToNull = (v: string) => (v.trim() === '' ? null : v);

function toFormState(initial?: InvoiceInput): FormState {
  const today = todayIso();
  return {
    contactId: initial?.contactId ?? null,
    number: initial?.number ?? '',
    variableSymbol: initial?.variableSymbol ?? '',
    constantSymbol: initial?.constantSymbol ?? '',
    customerName: initial?.customerName ?? '',
    customerIco: initial?.customerIco ?? '',
    customerIcDph: initial?.customerIcDph ?? '',
    customerDic: initial?.customerDic ?? '',
    customerStreet: initial?.customerStreet ?? '',
    customerZip: initial?.customerZip ?? '',
    customerCity: initial?.customerCity ?? '',
    customerCountry: initial?.customerCountry ?? '',
    customerEmail: initial?.customerEmail ?? '',
    customerCcEmails: (initial?.customerCcEmails ?? []).join(', '),
    issueDate: initial?.issueDate ?? today,
    dueDate: initial?.dueDate ?? today,
    deliveryDate: initial?.deliveryDate ?? today,
    introText: initial?.introText ?? '',
    note: initial?.note ?? '',
    currency: initial?.currency ?? 'EUR',
    items:
      initial?.items && initial.items.length > 0
        ? initial.items.map((i) => ({
            description: i.description,
            quantity: String(i.quantity),
            unit: i.unit,
            unitPrice: String(i.unitPrice),
            vatRate: String(i.vatRate),
          }))
        : [emptyItem()],
  };
}

function toRawInput(state: FormState) {
  return {
    contactId: state.contactId,
    number: state.number,
    variableSymbol: emptyToNull(state.variableSymbol),
    constantSymbol: emptyToNull(state.constantSymbol),
    customerName: state.customerName,
    customerIco: emptyToNull(state.customerIco),
    customerIcDph: emptyToNull(state.customerIcDph),
    customerDic: emptyToNull(state.customerDic),
    customerStreet: emptyToNull(state.customerStreet),
    customerZip: emptyToNull(state.customerZip),
    customerCity: emptyToNull(state.customerCity),
    customerCountry: emptyToNull(state.customerCountry),
    customerEmail: state.customerEmail,
    customerCcEmails: state.customerCcEmails
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    issueDate: state.issueDate,
    dueDate: state.dueDate,
    deliveryDate: state.deliveryDate,
    introText: emptyToNull(state.introText),
    note: emptyToNull(state.note),
    currency: state.currency,
    items: state.items.map((item) => ({
      description: item.description,
      quantity: parseNum(item.quantity),
      unit: item.unit,
      unitPrice: parseNum(item.unitPrice),
      vatRate: parseNum(item.vatRate),
    })),
  };
}

export function InvoiceForm({ initial, invoiceId }: { initial?: InvoiceInput; invoiceId?: string }) {
  const router = useRouter();
  const isNew = !invoiceId;

  const [state, setState] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [prefilled, setPrefilled] = useState(false);

  const settingsQuery = trpc.settings.get.useQuery();
  const suggestQuery = trpc.invoices.suggestNumber.useQuery(
    { year: new Date().getFullYear() },
    { enabled: isNew },
  );
  const contactsQuery = trpc.contacts.list.useQuery({});

  useEffect(() => {
    if (!isNew || prefilled || !settingsQuery.data || !suggestQuery.data) return;
    const today = todayIso();
    setState((s) => ({
      ...s,
      number: suggestQuery.data.number,
      variableSymbol: suggestQuery.data.number,
      constantSymbol: settingsQuery.data.defaultConstantSymbol ?? '',
      introText: settingsQuery.data.defaultIntroText ?? '',
      note: settingsQuery.data.defaultNote ?? '',
      issueDate: today,
      deliveryDate: today,
      dueDate: addDays(today, settingsQuery.data.defaultDueDays ?? 14),
    }));
    setPrefilled(true);
  }, [isNew, prefilled, settingsQuery.data, suggestQuery.data]);

  const create = trpc.invoices.create.useMutation({
    onSuccess: ({ id }) => router.push(`/invoices/${id}`),
  });
  const update = trpc.invoices.update.useMutation({
    onSuccess: ({ id }) => router.push(`/invoices/${id}`),
  });
  const submitting = create.isPending || update.isPending;
  const serverError = create.error ?? update.error;

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setState((s) => ({ ...s, [key]: e.target.value }));

  const handleContactChange = (e: { target: { value: string } }) => {
    const id = e.target.value;
    if (!id) {
      setState((s) => ({ ...s, contactId: null }));
      return;
    }
    const contact = contactsQuery.data?.find((c) => c.id === id);
    if (!contact) return;
    const dueDays = contact.defaultDueDays ?? settingsQuery.data?.defaultDueDays ?? 14;
    setState((s) => ({
      ...s,
      contactId: contact.id,
      customerName: contact.companyName,
      customerIco: contact.ico ?? '',
      customerIcDph: contact.icDph ?? '',
      customerDic: contact.dic ?? '',
      customerStreet: contact.street ?? '',
      customerZip: contact.zip ?? '',
      customerCity: contact.city ?? '',
      customerCountry: contact.country ?? '',
      customerEmail: contact.email ?? '',
      customerCcEmails: (contact.ccEmails ?? []).join(', '),
      dueDate: addDays(s.issueDate, dueDays),
    }));
  };

  const updateItem = (idx: number, key: keyof ItemRow) => (e: { target: { value: string } }) => {
    const raw = e.target.value;
    const value = key === 'description' || key === 'unit' ? raw : raw.replace(',', '.');
    setState((s) => ({
      ...s,
      items: s.items.map((item, i) => (i === idx ? { ...item, [key]: value } : item)),
    }));
  };

  const addItem = () => setState((s) => ({ ...s, items: [...s.items, emptyItem()] }));
  const removeItem = (idx: number) =>
    setState((s) => ({ ...s, items: s.items.filter((_, i) => i !== idx) }));

  const totals = calcInvoiceTotals(
    state.items.map((item) => ({
      quantity: parseNum(item.quantity),
      unitPrice: parseNum(item.unitPrice),
      vatRate: parseNum(item.vatRate),
    })),
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = invoiceInputSchema.safeParse(toRawInput(state));
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? '');
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    if (invoiceId) update.mutate({ id: invoiceId, data: result.data });
    else create.mutate(result.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
      <Card>
        <CardTitle>Faktúra</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <Field label="Číslo faktúry *" error={errors.number}>
            <Input data-testid="number" value={state.number} onChange={set('number')} />
          </Field>
          <Field label="Variabilný symbol" error={errors.variableSymbol}>
            <Input inputMode="numeric" data-testid="variableSymbol" value={state.variableSymbol} onChange={set('variableSymbol')} />
          </Field>
          <Field label="Konštantný symbol" error={errors.constantSymbol}>
            <Input inputMode="numeric" data-testid="constantSymbol" value={state.constantSymbol} onChange={set('constantSymbol')} />
          </Field>
          <Field label="Kontakt" className="col-span-2 max-sm:order-first sm:col-span-1">
            <Select data-testid="contact-select" value={state.contactId ?? ''} onChange={handleContactChange}>
              <option value="">— Bez kontaktu —</option>
              {(contactsQuery.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mena" error={errors.currency}>
            <Input data-testid="currency" value={state.currency} onChange={set('currency')} />
          </Field>
          <Field label="Dátum vystavenia" error={errors.issueDate}>
            <Input data-testid="issueDate" type="date" value={state.issueDate} onChange={set('issueDate')} />
          </Field>
          <Field label="Dátum splatnosti" error={errors.dueDate}>
            <Input data-testid="dueDate" type="date" value={state.dueDate} onChange={set('dueDate')} />
          </Field>
          <Field label="Dátum dodania" error={errors.deliveryDate}>
            <Input data-testid="deliveryDate" type="date" value={state.deliveryDate} onChange={set('deliveryDate')} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Odberateľ</CardTitle>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <div className="col-span-2">
            <Field label="Názov odberateľa *" error={errors.customerName}>
              <Input data-testid="customerName" value={state.customerName} onChange={set('customerName')} />
            </Field>
          </div>
          <Field label="IČO" error={errors.customerIco}>
            <Input data-testid="customerIco" value={state.customerIco} onChange={set('customerIco')} />
          </Field>
          <Field label="IČ DPH" error={errors.customerIcDph}>
            <Input data-testid="customerIcDph" value={state.customerIcDph} onChange={set('customerIcDph')} />
          </Field>
          <Field label="DIČ" error={errors.customerDic} className="col-span-2 sm:col-span-1">
            <Input data-testid="customerDic" value={state.customerDic} onChange={set('customerDic')} />
          </Field>
          <Field label="Ulica a číslo" error={errors.customerStreet} className="col-span-2 sm:col-span-1">
            <Input data-testid="customerStreet" value={state.customerStreet} onChange={set('customerStreet')} />
          </Field>
          <Field label="PSČ" error={errors.customerZip}>
            <Input data-testid="customerZip" value={state.customerZip} onChange={set('customerZip')} />
          </Field>
          <Field label="Mesto" error={errors.customerCity}>
            <Input data-testid="customerCity" value={state.customerCity} onChange={set('customerCity')} />
          </Field>
          <Field label="Krajina" error={errors.customerCountry} className="col-span-2 sm:col-span-1">
            <Input data-testid="customerCountry" value={state.customerCountry} onChange={set('customerCountry')} />
          </Field>
          <Field label="E-mail" error={errors.customerEmail} className="col-span-2 sm:col-span-1">
            <Input data-testid="customerEmail" type="email" value={state.customerEmail} onChange={set('customerEmail')} />
          </Field>
          <Field label="Kópia (CC) e-maily, oddelené čiarkou" error={errors.customerCcEmails} className="col-span-2 sm:col-span-1">
            <Input data-testid="customerCcEmails" value={state.customerCcEmails} onChange={set('customerCcEmails')} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Položky</CardTitle>
        <div
          className={cn(
            'hidden border-b border-line pb-3 text-xs font-medium uppercase tracking-wide text-muted md:grid',
            ITEM_COLS,
          )}
        >
          <span>Popis</span>
          <span>Množstvo</span>
          <span>MJ</span>
          <span>Cena/j</span>
          <span>DPH %</span>
          <span className="text-right">Spolu</span>
          <span />
        </div>
        {/* One DOM: a boxed card per item on phones, a table row from md up. */}
        <div className="space-y-3 md:space-y-0 md:divide-y md:divide-line">
          {state.items.map((item, idx) => {
            const rowTotal = calcItemTotals({
              quantity: parseNum(item.quantity),
              unitPrice: parseNum(item.unitPrice),
              vatRate: parseNum(item.vatRate),
            }).total;
            return (
              <div
                key={idx}
                className={cn(
                  'grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 md:items-center md:rounded-none md:bg-transparent md:px-0 md:py-3',
                  ITEM_COLS,
                )}
              >
                <ItemField label="Popis" className="col-span-2 md:col-span-1">
                  <Input data-testid={`item-desc-${idx}`} value={item.description} onChange={updateItem(idx, 'description')} />
                </ItemField>
                <ItemField label="Množstvo">
                  <Input
                    data-testid={`item-qty-${idx}`}
                    inputMode="decimal"
                    value={item.quantity}
                    onChange={updateItem(idx, 'quantity')}
                  />
                </ItemField>
                <ItemField label="MJ">
                  <Input data-testid={`item-unit-${idx}`} value={item.unit} onChange={updateItem(idx, 'unit')} />
                </ItemField>
                <ItemField label="Cena/j">
                  <Input
                    data-testid={`item-price-${idx}`}
                    inputMode="decimal"
                    value={item.unitPrice}
                    onChange={updateItem(idx, 'unitPrice')}
                  />
                </ItemField>
                <ItemField label="DPH %">
                  <Input
                    data-testid={`item-vat-${idx}`}
                    inputMode="decimal"
                    value={item.vatRate}
                    onChange={updateItem(idx, 'vatRate')}
                  />
                </ItemField>
                <div className="flex items-center justify-between gap-2 md:contents">
                  <span className="text-sm tabular-nums md:text-right" data-testid={`item-total-${idx}`}>
                    <span className="text-muted md:hidden">Spolu </span>
                    {formatMoney(rowTotal, state.currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Odstrániť položku"
                    className="px-3 text-subtle hover:text-danger"
                    data-testid={`item-remove-${idx}`}
                    onClick={() => removeItem(idx)}
                  >
                    <TrashIcon size={18} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {errors.items && <p className="mt-3 text-xs text-danger">{errors.items}</p>}
        <Button
          type="button"
          variant="secondary"
          className="mt-4 w-full sm:w-auto"
          data-testid="add-item"
          onClick={addItem}
        >
          <PlusIcon size={18} />
          Pridať položku
        </Button>
      </Card>

      <Card>
        <CardTitle>Poznámky</CardTitle>
        <div className="grid grid-cols-1 gap-4">
          <Field label="Úvodný text" error={errors.introText}>
            <Input data-testid="introText" value={state.introText} onChange={set('introText')} />
          </Field>
          <Field label="Poznámka" error={errors.note}>
            <Input data-testid="note" value={state.note} onChange={set('note')} />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex w-full flex-col gap-2 text-sm tabular-nums sm:ml-auto sm:max-w-xs">
          <div className="flex justify-between">
            <span className="text-muted">Základ dane</span>
            <span data-testid="totals-base">{formatMoney(totals.base, state.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">DPH</span>
            <span data-testid="totals-vat">{formatMoney(totals.vat, state.currency)}</span>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold">
            <span>Spolu</span>
            <span data-testid="totals-total">{formatMoney(totals.total, state.currency)}</span>
          </div>
        </div>
      </Card>

      {serverError && (
        <p data-testid="form-error" className="text-sm text-danger">
          {serverError.message}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/invoices')}>
          Zrušiť
        </Button>
        <Button type="submit" data-testid="save" disabled={submitting}>
          {submitting ? 'Ukladá sa…' : 'Uložiť'}
        </Button>
      </div>
    </form>
  );
}
