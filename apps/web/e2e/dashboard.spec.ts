import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('dashboard shows zeros for fresh account and updates after invoice exists', async ({ page }) => {
  await registerAndLogin(page);
  await expect(page.getByTestId('stat-invoiced')).toContainText('0,00');

  // create invoice through UI once Task 17 exists; until then seed via API from the browser context:
  await page.evaluate(async () => {
    const res = await fetch('http://localhost:3333/trpc/invoices.create', {
      method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ json: {
        number: `${new Date().getFullYear()}0001`, customerName: 'Test s.r.o.',
        issueDate: new Date().toISOString().slice(0, 10), dueDate: new Date().toISOString().slice(0, 10),
        deliveryDate: new Date().toISOString().slice(0, 10),
        items: [{ description: 'X', quantity: 1, unitPrice: 150, vatRate: 0, unit: 'ks' }],
        customerCcEmails: [], currency: 'EUR',
      } }),
    });
    if (!res.ok) throw new Error('seed failed: ' + (await res.text()));
  });
  await page.reload();
  await expect(page.getByTestId('stat-invoiced')).toContainText('150,00');
  await expect(page.getByTestId('monthly-chart')).toBeVisible();
  await expect(page.getByTestId(`invoice-row-${new Date().getFullYear()}0001`)).toBeVisible();
});
