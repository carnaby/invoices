'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ContactInput } from '@invoices/shared';
import { contactInputSchema } from '@invoices/shared';
import { Button, Card, Field, Input } from '@/components/ui';

type FormState = {
  companyName: string;
  ico: string;
  icDph: string;
  dic: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  email: string;
  ccEmails: string;
  phone: string;
  contactFirstName: string;
  contactLastName: string;
  defaultDueDays: string;
  discountPercent: string;
  iban: string;
  swift: string;
};

function toFormState(initial?: ContactInput & { id?: string }): FormState {
  return {
    companyName: initial?.companyName ?? '',
    ico: initial?.ico ?? '',
    icDph: initial?.icDph ?? '',
    dic: initial?.dic ?? '',
    street: initial?.street ?? '',
    zip: initial?.zip ?? '',
    city: initial?.city ?? '',
    country: initial?.country ?? 'Slovensko',
    email: initial?.email ?? '',
    ccEmails: (initial?.ccEmails ?? []).join(', '),
    phone: initial?.phone ?? '',
    contactFirstName: initial?.contactFirstName ?? '',
    contactLastName: initial?.contactLastName ?? '',
    defaultDueDays: initial?.defaultDueDays != null ? String(initial.defaultDueDays) : '',
    discountPercent: initial?.discountPercent != null ? String(initial.discountPercent) : '0',
    iban: initial?.iban ?? '',
    swift: initial?.swift ?? '',
  };
}

// Cleared optional fields must serialize to `null`, not `undefined`: drizzle's
// `.set()` skips `undefined` columns entirely, so an `undefined` value would
// silently leave the previous saved value in place instead of clearing it.
const emptyToNull = (v: string) => (v.trim() === '' ? null : v);

function toRawInput(state: FormState) {
  return {
    companyName: state.companyName,
    ico: emptyToNull(state.ico),
    icDph: emptyToNull(state.icDph),
    dic: emptyToNull(state.dic),
    street: emptyToNull(state.street),
    zip: emptyToNull(state.zip),
    city: emptyToNull(state.city),
    country: state.country,
    email: state.email,
    ccEmails: state.ccEmails
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    phone: emptyToNull(state.phone),
    contactFirstName: emptyToNull(state.contactFirstName),
    contactLastName: emptyToNull(state.contactLastName),
    defaultDueDays: state.defaultDueDays.trim() === '' ? null : Number(state.defaultDueDays),
    discountPercent: state.discountPercent.trim() === '' ? undefined : Number(state.discountPercent),
    iban: emptyToNull(state.iban),
    swift: emptyToNull(state.swift),
  };
}

export function ContactForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: ContactInput & { id?: string };
  onSubmit: (data: ContactInput) => void;
  submitting: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toFormState(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setState((s) => ({ ...s, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = contactInputSchema.safeParse(toRawInput(state));
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
    onSubmit(result.data);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Firma</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Názov firmy *" error={errors.companyName}>
              <Input data-testid="companyName" value={state.companyName} onChange={set('companyName')} />
            </Field>
          </div>
          <Field label="IČO" error={errors.ico}>
            <Input data-testid="ico" value={state.ico} onChange={set('ico')} />
          </Field>
          <Field label="IČ DPH" error={errors.icDph}>
            <Input data-testid="icDph" value={state.icDph} onChange={set('icDph')} />
          </Field>
          <Field label="DIČ" error={errors.dic}>
            <Input data-testid="dic" value={state.dic} onChange={set('dic')} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Adresa</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Ulica a číslo" error={errors.street}>
              <Input data-testid="street" value={state.street} onChange={set('street')} />
            </Field>
          </div>
          <Field label="PSČ" error={errors.zip}>
            <Input data-testid="zip" value={state.zip} onChange={set('zip')} />
          </Field>
          <Field label="Mesto" error={errors.city}>
            <Input data-testid="city" value={state.city} onChange={set('city')} />
          </Field>
          <Field label="Krajina" error={errors.country}>
            <Input data-testid="country" value={state.country} onChange={set('country')} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Kontakt</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="E-mail" error={errors.email}>
            <Input data-testid="email" type="email" value={state.email} onChange={set('email')} />
          </Field>
          <Field label="Telefón" error={errors.phone}>
            <Input data-testid="phone" value={state.phone} onChange={set('phone')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Kópia (CC) e-maily, oddelené čiarkou" error={errors.ccEmails}>
              <Input
                data-testid="ccEmails"
                placeholder="napr. ucto@firma.sk, info@firma.sk"
                value={state.ccEmails}
                onChange={set('ccEmails')}
              />
            </Field>
          </div>
          <Field label="Meno kontaktnej osoby" error={errors.contactFirstName}>
            <Input data-testid="contactFirstName" value={state.contactFirstName} onChange={set('contactFirstName')} />
          </Field>
          <Field label="Priezvisko kontaktnej osoby" error={errors.contactLastName}>
            <Input data-testid="contactLastName" value={state.contactLastName} onChange={set('contactLastName')} />
          </Field>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Fakturácia</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Predvolená splatnosť (dni)" error={errors.defaultDueDays}>
            <Input
              data-testid="defaultDueDays"
              type="number"
              min={0}
              max={365}
              value={state.defaultDueDays}
              onChange={set('defaultDueDays')}
            />
          </Field>
          <Field label="Zľava (%)" error={errors.discountPercent}>
            <Input
              data-testid="discountPercent"
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={state.discountPercent}
              onChange={set('discountPercent')}
            />
          </Field>
          <Field label="IBAN" error={errors.iban}>
            <Input data-testid="iban" value={state.iban} onChange={set('iban')} />
          </Field>
          <Field label="SWIFT/BIC" error={errors.swift}>
            <Input data-testid="swift" value={state.swift} onChange={set('swift')} />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/contacts')}>
          Zrušiť
        </Button>
        <Button type="submit" data-testid="save" disabled={submitting}>
          {submitting ? 'Ukladá sa…' : 'Uložiť'}
        </Button>
      </div>
    </form>
  );
}
