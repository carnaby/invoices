import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

async function seedInvoice(page: import('@playwright/test').Page, number: string, unitPrice: number, dueDate: string) {
  await page.evaluate(async ({ number, unitPrice, dueDate }) => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('http://localhost:3333/trpc/invoices.create', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: {
        number, customerName: 'Test s.r.o.', issueDate: today, dueDate, deliveryDate: today,
        items: [{ description: 'X', quantity: 1, unitPrice, vatRate: 0, unit: 'ks' }],
        customerCcEmails: [], currency: 'EUR',
      } }),
    });
    if (!res.ok) throw new Error(await res.text());
  }, { number, unitPrice, dueDate });
}

test('list shows invoices with status filter and summary', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();
  await seedInvoice(page, `${y}0001`, 100, '2020-01-01'); // overdue
  await seedInvoice(page, `${y}0002`, 250, '2099-01-01'); // unpaid, not due

  await page.getByTestId('nav-invoices').click();
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toBeVisible();
  await expect(page.getByTestId(`invoice-row-${y}0002`)).toBeVisible();
  await expect(page.getByTestId('summary-count')).toContainText('2');
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toContainText('Po splatnosti');

  await page.getByTestId('status-filter').selectOption('overdue');
  await expect(page.getByTestId(`invoice-row-${y}0002`)).toBeHidden();
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toBeVisible();

  await page.getByTestId('status-filter').selectOption('');
  await page.getByTestId('search').fill(`${y}0002`);
  await expect(page.getByTestId(`invoice-row-${y}0001`)).toBeHidden();
  await expect(page.getByTestId(`invoice-row-${y}0002`)).toBeVisible();
});
