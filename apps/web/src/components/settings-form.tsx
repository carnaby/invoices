'use client';
import { useState } from 'react';
import type { SettingsInput } from '@invoices/shared';
import { Button, Card, Field, Input, Textarea } from '@/components/ui';
import { apiUrl, trpc } from '@/lib/trpc';

type SettingsData = SettingsInput & { hasSmtpPassword: boolean; hasSignature: boolean };

type FormState = {
  supplierName: string;
  supplierStreet: string;
  supplierZip: string;
  supplierCity: string;
  supplierCountry: string;
  supplierIco: string;
  supplierDic: string;
  supplierIcDph: string;
  registrationText: string;
  supplierEmail: string;
  supplierPhone: string;
  iban: string;
  swift: string;
  defaultDueDays: string;
  defaultConstantSymbol: string;
  defaultIntroText: string;
  defaultNote: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpSecure: boolean;
  emailFrom: string;
};

type TextField = Exclude<keyof FormState, 'smtpSecure'>;

function toFormState(s: SettingsData): FormState {
  return {
    supplierName: s.supplierName ?? '',
    supplierStreet: s.supplierStreet ?? '',
    supplierZip: s.supplierZip ?? '',
    supplierCity: s.supplierCity ?? '',
    supplierCountry: s.supplierCountry ?? 'Slovensko',
    supplierIco: s.supplierIco ?? '',
    supplierDic: s.supplierDic ?? '',
    supplierIcDph: s.supplierIcDph ?? '',
    registrationText: s.registrationText ?? '',
    supplierEmail: s.supplierEmail ?? '',
    supplierPhone: s.supplierPhone ?? '',
    iban: s.iban ?? '',
    swift: s.swift ?? '',
    defaultDueDays: s.defaultDueDays != null ? String(s.defaultDueDays) : '14',
    defaultConstantSymbol: s.defaultConstantSymbol ?? '0308',
    defaultIntroText: s.defaultIntroText ?? '',
    defaultNote: s.defaultNote ?? '',
    smtpHost: s.smtpHost ?? '',
    smtpPort: s.smtpPort != null ? String(s.smtpPort) : '',
    smtpUser: s.smtpUser ?? '',
    smtpSecure: s.smtpSecure ?? true,
    emailFrom: s.emailFrom ?? '',
  };
}

function buildPayload(form: FormState): SettingsInput {
  return {
    supplierName: form.supplierName,
    supplierStreet: form.supplierStreet,
    supplierZip: form.supplierZip,
    supplierCity: form.supplierCity,
    supplierCountry: form.supplierCountry,
    supplierIco: form.supplierIco,
    supplierDic: form.supplierDic,
    supplierIcDph: form.supplierIcDph,
    registrationText: form.registrationText,
    supplierEmail: form.supplierEmail,
    supplierPhone: form.supplierPhone,
    iban: form.iban,
    swift: form.swift,
    defaultDueDays: form.defaultDueDays.trim() === '' ? 14 : Number(form.defaultDueDays),
    defaultConstantSymbol: form.defaultConstantSymbol,
    defaultIntroText: form.defaultIntroText,
    defaultNote: form.defaultNote,
    smtpHost: form.smtpHost,
    smtpPort: form.smtpPort.trim() === '' ? null : Number(form.smtpPort),
    smtpUser: form.smtpUser,
    smtpSecure: form.smtpSecure,
    emailFrom: form.emailFrom,
  };
}

function SavedIndicator({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span data-testid="saved-indicator" className="text-sm font-medium text-[#34c759]">
      Uložené
    </span>
  );
}

export function SettingsForm({ initial }: { initial: SettingsData }) {
  const utils = trpc.useUtils();
  const live = trpc.settings.get.useQuery().data ?? initial;

  const [form, setForm] = useState<FormState>(() => toFormState(initial));
  const [password, setPassword] = useState('');
  const [savedCard, setSavedCard] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(0);

  const set = (key: TextField) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function markSaved(key: string) {
    setSavedCard(key);
    setTimeout(() => setSavedCard((c) => (c === key ? null : c)), 2000);
  }

  const update = trpc.settings.update.useMutation({
    onSuccess: (data) => {
      utils.settings.get.setData(undefined, () => data);
    },
  });
  const setSmtpPasswordMutation = trpc.settings.setSmtpPassword.useMutation({
    onSuccess: () => {
      utils.settings.get.setData(undefined, (old) => (old ? { ...old, hasSmtpPassword: true } : old));
      setPassword('');
      markSaved('smtp-password');
    },
  });
  const uploadSignature = trpc.settings.uploadSignature.useMutation({
    onSuccess: () => {
      utils.settings.get.setData(undefined, (old) => (old ? { ...old, hasSignature: true } : old));
      setCacheBust(Date.now());
    },
  });
  const deleteSignature = trpc.settings.deleteSignature.useMutation({
    onSuccess: () => {
      utils.settings.get.setData(undefined, (old) => (old ? { ...old, hasSignature: false } : old));
      setCacheBust(Date.now());
    },
  });
  const testSmtp = trpc.settings.testSmtp.useMutation();

  function saveGeneral(key: string) {
    update.mutate(buildPayload(form), { onSuccess: () => markSaved(key) });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      const base64 = result.slice(result.indexOf(',') + 1);
      uploadSignature.mutate({
        dataBase64: base64,
        mimeType: file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png',
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Dodávateľ</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Názov firmy">
              <Input data-testid="supplierName" value={form.supplierName} onChange={set('supplierName')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Ulica a číslo">
              <Input value={form.supplierStreet} onChange={set('supplierStreet')} />
            </Field>
          </div>
          <Field label="PSČ">
            <Input value={form.supplierZip} onChange={set('supplierZip')} />
          </Field>
          <Field label="Mesto">
            <Input value={form.supplierCity} onChange={set('supplierCity')} />
          </Field>
          <Field label="Krajina">
            <Input value={form.supplierCountry} onChange={set('supplierCountry')} />
          </Field>
          <Field label="IČO">
            <Input value={form.supplierIco} onChange={set('supplierIco')} />
          </Field>
          <Field label="DIČ">
            <Input value={form.supplierDic} onChange={set('supplierDic')} />
          </Field>
          <Field label="IČ DPH">
            <Input value={form.supplierIcDph} onChange={set('supplierIcDph')} />
          </Field>
          <Field label="E-mail">
            <Input type="email" value={form.supplierEmail} onChange={set('supplierEmail')} />
          </Field>
          <Field label="Telefón">
            <Input value={form.supplierPhone} onChange={set('supplierPhone')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Text o registrácii (napr. živnostenský register)">
              <Textarea value={form.registrationText} onChange={set('registrationText')} />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <SavedIndicator show={savedCard === 'supplier'} />
          <Button data-testid="save-supplier" disabled={update.isPending} onClick={() => saveGeneral('supplier')}>
            Uložiť
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Banka</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="IBAN">
            <Input data-testid="iban" value={form.iban} onChange={set('iban')} />
          </Field>
          <Field label="SWIFT/BIC">
            <Input value={form.swift} onChange={set('swift')} />
          </Field>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <SavedIndicator show={savedCard === 'bank'} />
          <Button data-testid="save-bank" disabled={update.isPending} onClick={() => saveGeneral('bank')}>
            Uložiť
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Fakturačné predvoľby</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Predvolená splatnosť (dni)">
            <Input
              data-testid="defaultDueDays"
              type="number"
              min={0}
              max={365}
              value={form.defaultDueDays}
              onChange={set('defaultDueDays')}
            />
          </Field>
          <Field label="Predvolený konštantný symbol">
            <Input value={form.defaultConstantSymbol} onChange={set('defaultConstantSymbol')} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Predvolený úvodný text faktúry">
              <Textarea value={form.defaultIntroText} onChange={set('defaultIntroText')} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Predvolená poznámka">
              <Textarea value={form.defaultNote} onChange={set('defaultNote')} />
            </Field>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <SavedIndicator show={savedCard === 'defaults'} />
          <Button data-testid="save-defaults" disabled={update.isPending} onClick={() => saveGeneral('defaults')}>
            Uložiť
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">SMTP</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="SMTP server">
            <Input data-testid="smtpHost" value={form.smtpHost} onChange={set('smtpHost')} />
          </Field>
          <Field label="Port">
            <Input data-testid="smtpPort" type="number" value={form.smtpPort} onChange={set('smtpPort')} />
          </Field>
          <Field label="Používateľ">
            <Input data-testid="smtpUser" value={form.smtpUser} onChange={set('smtpUser')} />
          </Field>
          <Field label="Odosielateľ (e-mail)">
            <Input data-testid="emailFrom" type="email" value={form.emailFrom} onChange={set('emailFrom')} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium text-[#1d1d1f] sm:col-span-2">
            <input
              type="checkbox"
              data-testid="smtpSecure"
              checked={form.smtpSecure}
              onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
              className="h-4 w-4 rounded border-[#e8e8ed] text-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
            Zabezpečené pripojenie (TLS)
          </label>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <SavedIndicator show={savedCard === 'smtp'} />
          <Button data-testid="save-smtp" disabled={update.isPending} onClick={() => saveGeneral('smtp')}>
            Uložiť
          </Button>
        </div>

        <div className="mt-6 border-t border-[#e8e8ed] pt-6">
          <Field label="Heslo k SMTP účtu">
            <Input
              data-testid="smtpPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={live.hasSmtpPassword ? '••••••••' : ''}
            />
          </Field>
          <div className="mt-3 flex items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              data-testid="save-smtp-password"
              disabled={!password.trim() || setSmtpPasswordMutation.isPending}
              onClick={() => setSmtpPasswordMutation.mutate({ password })}
            >
              Uložiť heslo
            </Button>
            {live.hasSmtpPassword && <span className="text-sm text-[#34c759]">Heslo je uložené</span>}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 border-t border-[#e8e8ed] pt-6">
          <Button
            type="button"
            variant="secondary"
            data-testid="test-smtp"
            disabled={testSmtp.isPending}
            onClick={() => testSmtp.mutate()}
          >
            Test SMTP
          </Button>
          {testSmtp.isSuccess && (
            <span data-testid="smtp-test-result" className="text-sm text-[#34c759]">
              Test prebehol úspešne.
            </span>
          )}
          {testSmtp.isError && (
            <span data-testid="smtp-test-result" className="text-sm text-[#ff3b30]">
              {testSmtp.error.message}
            </span>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-6 text-lg font-semibold tracking-tight">Podpis</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <input
              type="file"
              accept="image/png,image/jpeg"
              data-testid="signature-file"
              onChange={handleFile}
              className="block text-sm text-[#1d1d1f] file:mr-4 file:rounded-xl file:border-0 file:bg-[#0071e3] file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-white file:transition hover:file:bg-[#0077ed]"
            />
            {live.hasSignature && (
              <Button
                type="button"
                variant="danger"
                data-testid="delete-signature"
                className="mt-4"
                disabled={deleteSignature.isPending}
                onClick={() => deleteSignature.mutate()}
              >
                Odstrániť podpis
              </Button>
            )}
          </div>
          {live.hasSignature && (
            <img
              data-testid="signature-preview"
              src={`${apiUrl}/files/signature?${cacheBust}`}
              alt="Podpis"
              className="h-24 rounded-xl border border-[#e8e8ed] bg-white p-2"
            />
          )}
        </div>
      </Card>
    </div>
  );
}
