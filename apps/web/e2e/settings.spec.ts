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
