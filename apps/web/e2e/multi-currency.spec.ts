import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

async function seedInvoice(
  page: import('@playwright/test').Page,
  number: string,
  unitPrice: number,
  currency: string,
) {
  await page.evaluate(
    async ({ number, unitPrice, currency }) => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch('http://localhost:3333/trpc/invoices.create', {
        method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ json: {
          number, customerName: 'Test s.r.o.', issueDate: today, dueDate: today, deliveryDate: today,
          items: [{ description: 'X', quantity: 1, unitPrice, vatRate: 0, unit: 'ks' }],
          customerCcEmails: [], currency,
        } }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    { number, unitPrice, currency },
  );
}

test('multi-currency invoices render without crashing and can be inspected per currency', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();
  await seedInvoice(page, `${y}0001`, 100, 'EUR');
  await seedInvoice(page, `${y}0002`, 2500, 'CZK');

  await page.getByTestId('nav-invoices').click();
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toBeVisible();
  await expect(page.getByTestId(`invoice-row-${y}0002`)).toBeVisible();

  const summaryTotal = page.getByTestId('summary-total');
  await expect(summaryTotal).toBeVisible();
  const summaryText = (await summaryTotal.textContent()) ?? '';
  expect(summaryText).toMatch(/€|EUR/);
  expect(summaryText).toContain('CZK');

  await page.getByTestId('nav-dashboard').click();
  const currencySelect = page.getByTestId('currency-select');
  await expect(currencySelect).toBeVisible();

  const options = await currencySelect.locator('option').allTextContents();
  expect(options.sort()).toEqual(['CZK', 'EUR'].sort());

  await currencySelect.selectOption('EUR');
  const eurInvoiced = await page.getByTestId('stat-invoiced').textContent();

  await currencySelect.selectOption('CZK');
  const czkInvoiced = await page.getByTestId('stat-invoiced').textContent();

  expect(eurInvoiced).not.toEqual(czkInvoiced);
  expect(czkInvoiced ?? '').toContain('CZK');
});
