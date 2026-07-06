import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('create invoice with two items, live totals, then edit', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();

  await page.goto('/invoices/new');
  await expect(page.getByTestId('number')).toHaveValue(`${y}0001`); // suggested

  await page.getByTestId('customerName').fill('Test s.r.o.');
  await page.getByTestId('item-desc-0').fill('Programátorské práce');
  await page.getByTestId('item-qty-0').fill('2');
  await page.getByTestId('item-price-0').fill('100');
  await page.getByTestId('item-vat-0').fill('20');
  await page.getByTestId('add-item').click();
  await page.getByTestId('item-desc-1').fill('Konzultácie');
  await page.getByTestId('item-qty-1').fill('1');
  await page.getByTestId('item-price-1').fill('50,50');
  await expect(page.getByTestId('totals-total')).toContainText('290,50');

  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));

  await page.getByTestId('edit-invoice').click();
  await page.getByTestId('item-remove-1').click();
  await expect(page.getByTestId('totals-total')).toContainText('240,00');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(new RegExp('/invoices/[0-9a-f-]{36}$'));
});

test('contact selection prefills customer snapshot', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/contacts/new');
  await page.getByTestId('companyName').fill('Prefill s.r.o.');
  await page.getByTestId('ico').fill('11223344');
  await page.getByTestId('city').fill('Žilina');
  await page.getByTestId('save').click();

  await page.goto('/invoices/new');
  await page.getByTestId('contact-select').selectOption({ label: 'Prefill s.r.o.' });
  await expect(page.getByTestId('customerName')).toHaveValue('Prefill s.r.o.');
  await expect(page.getByTestId('customerIco')).toHaveValue('11223344');
  await expect(page.getByTestId('customerCity')).toHaveValue('Žilina');
});

test('missing items shows validation error', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/invoices/new');
  await page.getByTestId('customerName').fill('X s.r.o.');
  await page.getByTestId('item-remove-0').click();
  await page.getByTestId('save').click();
  await expect(page.getByText('Faktúra musí mať aspoň jednu položku')).toBeVisible();
});
