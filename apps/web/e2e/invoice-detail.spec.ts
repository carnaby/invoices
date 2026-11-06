import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';
import { lockWithOriginal } from './db';

test('locked iDoklad invoice: no edit or delete, both PDFs download, payments still work', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('Zámok s.r.o.');
  await page.getByTestId('item-desc-0').fill('Práce');
  await page.getByTestId('item-qty-0').fill('1');
  await page.getByTestId('item-price-0').fill('100');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));
  const id = page.url().split('/').pop()!;

  // A form and a detail opened before the lock must show the Slovak lock message on save and delete.
  const stale = await page.context().newPage();
  await stale.goto(`/invoices/${id}/edit`);
  await expect(stale.getByTestId('save')).toBeVisible();
  const staleDetail = await page.context().newPage();
  await staleDetail.goto(`/invoices/${id}`);
  await expect(staleDetail.getByTestId('delete-invoice')).toBeVisible();

  await lockWithOriginal(id, Buffer.from('%PDF-1.4 e2e original'), 'faktura-e2e.pdf');

  await stale.getByTestId('save').click();
  await expect(stale.getByText('Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.')).toBeVisible();
  await stale.close();

  await staleDetail.getByTestId('delete-invoice').click();
  await staleDetail.getByTestId('confirm').click();
  await expect(staleDetail.getByTestId('confirm-error')).toContainText(
    'Faktúra z iDokladu je uzamknutá a nedá sa meniť ani zmazať.',
  );
  await expect(staleDetail).toHaveURL(new RegExp(`/invoices/${id}$`));
  // The page behind the dialog refreshes: the lock shows without a reload.
  await expect(staleDetail.getByTestId('locked-badge')).toContainText('z iDokladu');
  await expect(staleDetail.getByTestId('delete-invoice')).toHaveCount(0);
  await staleDetail.close();

  await page.reload();
  await expect(page.getByTestId('locked-badge')).toContainText('Uzamknutá');
  await expect(page.getByTestId('edit-invoice')).toHaveCount(0);
  await expect(page.getByTestId('delete-invoice')).toHaveCount(0);
  await expect(page.getByTestId('mark-paid')).toBeVisible();

  const original = await page.request.get((await page.getByTestId('download-original').getAttribute('href'))!);
  expect(original.status()).toBe(200);
  expect((await original.body()).subarray(0, 5).toString()).toBe('%PDF-');
  expect(original.headers()['content-disposition']).toContain('-original.pdf');

  const generated = await page.request.get((await page.getByTestId('download-pdf').getAttribute('href'))!);
  expect(generated.status()).toBe(200);
  expect(generated.headers()['content-type']).toContain('application/pdf');

  await page.goto(`/invoices/${id}/edit`);
  await expect(page.getByTestId('locked-message')).toBeVisible();
  await expect(page.getByTestId('save')).toHaveCount(0);
});

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
  await expect(page.getByText('Uhradená', { exact: false }).first()).toBeVisible();

  // A fully paid invoice is locked.
  await expect(page.getByTestId('locked-badge')).toContainText('Uzamknutá · uhradená');
  await expect(page.getByTestId('edit-invoice')).toHaveCount(0);
  await expect(page.getByTestId('delete-invoice')).toHaveCount(0);
  const id = page.url().split('/').pop()!;
  await page.goto(`/invoices/${id}/edit`);
  await expect(page.getByTestId('locked-message')).toContainText('Uhradená faktúra je uzamknutá');
  await page.goto(`/invoices/${id}`);

  const pdfResponse = await page.request.get(
    (await page.getByTestId('download-pdf').getAttribute('href'))!,
  );
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');

  // Resetting the payments unlocks it again.
  await page.getByTestId('reset-payments').click();
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('locked-badge')).toHaveCount(0);
  await expect(page.getByText('Neuhradená')).toBeVisible();
  await expect(page.getByTestId('reset-payments')).toHaveCount(0);

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

test('partial payments add up and the second one prefills the remaining amount', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('Splátky s.r.o.');
  await page.getByTestId('item-desc-0').fill('Práce');
  await page.getByTestId('item-qty-0').fill('1');
  await page.getByTestId('item-price-0').fill('120');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));

  await page.getByTestId('mark-paid').click();
  await expect(page.getByTestId('paid-amount')).toHaveValue('120');
  await page.getByTestId('paid-amount').fill('50');
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('paid-info')).toContainText('50,00');
  await expect(page.getByTestId('paid-info')).toContainText('120,00');

  await page.getByTestId('mark-paid').click();
  await expect(page.getByTestId('already-paid')).toContainText('50,00');
  await expect(page.getByTestId('paid-amount')).toHaveValue('70');
  await page.getByTestId('paid-amount').fill('70,01');
  await expect(page.getByTestId('paid-amount-error')).toContainText('Úhrada presahuje zostávajúcu sumu 70,00');
  await expect(page.getByTestId('confirm')).toBeDisabled();
  await page.getByTestId('paid-amount').fill('70');
  await expect(page.getByTestId('paid-amount-error')).toHaveCount(0);
  await page.getByTestId('confirm').click();
  await expect(page.getByText('Uhradená', { exact: true })).toBeVisible();
});

test('a payment refused because another tab paid meanwhile refreshes the dialog', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('Dve karty s.r.o.');
  await page.getByTestId('item-desc-0').fill('Práce');
  await page.getByTestId('item-qty-0').fill('1');
  await page.getByTestId('item-price-0').fill('120');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));

  await page.getByTestId('mark-paid').click();
  await expect(page.getByTestId('paid-amount')).toHaveValue('120');

  const other = await page.context().newPage();
  await other.goto(page.url());
  await other.getByTestId('mark-paid').click();
  await other.getByTestId('paid-amount').fill('50');
  await other.getByTestId('confirm').click();
  await expect(other.getByTestId('paid-info')).toContainText('50,00');
  await other.close();

  await page.getByTestId('confirm').click();
  await expect(page.getByText('Úhrada presahuje zostávajúcu sumu 70,00').first()).toBeVisible();
  await expect(page.getByTestId('already-paid')).toContainText('50,00');
  await expect(page.getByTestId('confirm')).toBeDisabled();
});
