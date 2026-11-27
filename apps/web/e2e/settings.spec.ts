import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('settings persist across reload', async ({ page }) => {
  await registerAndLogin(page);
  await page.getByTestId('nav-settings').click();

  await page.getByTestId('supplierName').fill('Ján Testovací');
  await page.getByTestId('save-supplier').click();
  await expect(page.getByTestId('saved-indicator').first()).toBeVisible();

  await page.getByTestId('iban').fill('SK3112000000198742637541');
  await page.getByTestId('save-bank').click();

  await page.getByTestId('defaultDueDays').fill('21');
  await page.getByTestId('save-defaults').click();

  await page.reload();
  await expect(page.getByTestId('supplierName')).toHaveValue('Ján Testovací');
  await expect(page.getByTestId('iban')).toHaveValue('SK3112000000198742637541');
  await expect(page.getByTestId('defaultDueDays')).toHaveValue('21');
});

test('a § 7a IČ DPH shows only on invoices for customers outside Slovakia', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/settings');
  await page.getByTestId('supplierName').fill('Ján Testovací');
  await page.getByTestId('supplierIcDph').fill('SK1000000001');
  await expect(page.getByTestId('supplierVatRegistration')).toHaveValue('identified');
  await page.getByTestId('save-supplier').click();
  await expect(page.getByTestId('saved-indicator').first()).toBeVisible();

  const ids: Record<string, string> = {};
  for (const [number, country] of [['20260001', 'Slovensko'], ['20260002', 'Česká republika']]) {
    ids[country] = await page.evaluate(async ({ number, country }) => {
      const res = await fetch('http://localhost:3333/trpc/invoices.create', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ json: {
          number, customerName: 'Odberateľ s.r.o.', customerCountry: country,
          issueDate: '2026-01-10', dueDate: '2026-01-24', deliveryDate: '2026-01-10',
          items: [{ description: 'X', quantity: 1, unitPrice: 100, vatRate: 0, unit: 'ks' }],
          customerCcEmails: [], currency: 'EUR',
        } }),
      });
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()).result.data.json.id as string;
    }, { number, country });
  }

  await page.goto(`/invoices/${ids['Slovensko']}`);
  await expect(page.getByText('Ján Testovací')).toBeVisible();
  await expect(page.getByText('SK1000000001')).toHaveCount(0);
  await page.goto(`/invoices/${ids['Česká republika']}`);
  await expect(page.getByText('IČ DPH: SK1000000001')).toBeVisible();

  await page.goto('/settings');
  await page.getByTestId('supplierVatRegistration').selectOption('payer');
  await page.getByTestId('save-supplier').click();
  await expect(page.getByTestId('saved-indicator').first()).toBeVisible();
  await page.goto(`/invoices/${ids['Slovensko']}`);
  await expect(page.getByText('IČ DPH: SK1000000001')).toBeVisible();
});

test('signature upload shows preview and can be deleted', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/settings');
  // 1x1 px PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  await page.getByTestId('signature-file').setInputFiles({ name: 'sig.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByTestId('signature-preview')).toBeVisible();
  await page.getByTestId('delete-signature').click();
  await expect(page.getByTestId('signature-preview')).toBeHidden();
});

test('smtp password save marks configured state', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/settings');
  await page.getByTestId('smtpHost').fill('smtp.example.com');
  await page.getByTestId('save-smtp').click();
  await page.getByTestId('smtpPassword').fill('tajne-heslo');
  await page.getByTestId('save-smtp-password').click();
  await expect(page.getByText('Heslo je uložené')).toBeVisible();
});
