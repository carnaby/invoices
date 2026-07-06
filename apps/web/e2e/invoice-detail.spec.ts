import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('detail: totals, mark paid, pdf download, delete', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('Detail s.r.o.');
  await page.getByTestId('item-desc-0').fill('Práce');
  await page.getByTestId('item-qty-0').fill('1');
  await page.getByTestId('item-price-0').fill('120');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));

  await expect(page.getByTestId('totals-total')).toContainText('120,00');
  await expect(page.getByText('Neuhradená')).toBeVisible();

  await page.getByTestId('mark-paid').click();
  await page.getByTestId('pay-full').click();
  await page.getByTestId('confirm').click();
  await expect(page.getByText('Uhradená', { exact: false })).toBeVisible();

  const pdfResponse = await page.request.get(
    (await page.getByTestId('download-pdf').getAttribute('href'))!,
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

  await page.getByTestId('delete-invoice').click();
  await page.getByTestId('confirm').click();
  await expect(page).toHaveURL(/\/invoices$/);
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toBeHidden();
});

test('send email without smtp shows Slovak error', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('Mail s.r.o.');
  await page.getByTestId('customerEmail').fill('mail@example.com');
  await page.getByTestId('item-desc-0').fill('Práce');
  await page.getByTestId('item-qty-0').fill('1');
  await page.getByTestId('item-price-0').fill('10');
  await page.getByTestId('save').click();

  await page.getByTestId('send-email').click();
  await page.getByTestId('email-send').click();
  await expect(page.getByTestId('email-error')).toContainText('SMTP nie je nakonfigurované');
});
