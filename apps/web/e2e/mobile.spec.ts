import { expect, test, type Page } from '@playwright/test';
import { registerAndLogin } from './helpers';

// iPhone-sized viewport in Chromium (the suite only runs Chromium).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test('phone: tab bar navigation, no horizontal scroll, payment dialog and logout', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();
  await page.evaluate(async (number) => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch('http://localhost:3333/trpc/invoices.create', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        json: {
          number,
          customerName: 'Mobilná s.r.o. s veľmi dlhým názvom odberateľa',
          issueDate: today,
          dueDate: today,
          deliveryDate: today,
          items: [{ description: 'Služby', quantity: 3, unitPrice: 1234.56, vatRate: 0, unit: 'hod' }],
          customerCcEmails: [],
          currency: 'EUR',
        },
      }),
    });
    if (!res.ok) throw new Error(await res.text());
  }, `${y}0001`);

  // The desktop sidebar footer is hidden; the tab bar is there instead.
  await expect(page.getByTestId('logout')).toBeHidden();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('nav-invoices').click();
  const row = page.getByTestId(`invoice-row-${y}0001`);
  await expect(row).toBeVisible();
  await expectNoHorizontalScroll(page);

  await row.click();
  await expect(page.getByTestId('totals-total')).toContainText('3 703,68');
  await expectNoHorizontalScroll(page);

  // The action buttons must not sit under any fixed bar.
  await page.getByTestId('mark-paid').click();
  await expect(page.getByTestId('paid-amount')).toBeVisible();
  await page.getByTestId('cancel').click();

  await page.getByTestId('nav-new-invoice').click();
  await expect(page).toHaveURL(/\/invoices\/new/);
  await expect(page.getByTestId('item-desc-0')).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('nav-contacts').click();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('nav-settings').click();
  await expectNoHorizontalScroll(page);
  await page.getByTestId('account-logout').click();
  await expect(page).toHaveURL(/\/login/);
});

test('web app manifest and service worker are served', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.display).toBe('standalone');
  for (const icon of body.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const sw = await request.get('/sw.js');
  expect(sw.headers()['content-type']).toContain('javascript');
});
