import { expect, test, type Page } from '@playwright/test';
import { registerAndLogin } from './helpers';

// iPhone-sized viewport in Chromium (the suite only runs Chromium).
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Every amount in a summary tile must be fully visible, never clipped by the tile. */
async function expectStatValuesVisible(page: Page) {
  await expect(page.locator('[data-stat-value]').first()).toBeVisible();
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-stat-value]')]
      .filter((p) => p.scrollWidth > p.clientWidth + 1)
      .map((p) => p.textContent),
  );
  expect(clipped).toEqual([]);
}

async function createInvoice(page: Page, number: string, unitPrice: number, currency: string) {
  await page.evaluate(
    async ({ number, unitPrice, currency }) => {
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
            items: [{ description: 'Služby', quantity: 3, unitPrice, vatRate: 0, unit: 'hod' }],
            customerCcEmails: [],
            currency,
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
    },
    { number, unitPrice, currency },
  );
}

test('phone: tab bar navigation, no horizontal scroll, payment dialog and logout', async ({ page }) => {
  await registerAndLogin(page);
  const y = new Date().getFullYear();
  await createInvoice(page, `${y}0001`, 1234.56, 'EUR');
  // A long amount in a second currency: summary tiles must not clip it on a phone.
  await createInvoice(page, `${y}0002`, 411522.63, 'CZK');
  await page.reload();
  await expectStatValuesVisible(page);
  // Year select stays compact instead of taking the whole header row.
  expect((await page.getByTestId('year-select').boundingBox())!.width).toBeLessThan(160);

  // The desktop sidebar footer is hidden; the tab bar is there instead.
  await expect(page.getByTestId('logout')).toBeHidden();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('nav-invoices').click();
  const row = page.getByTestId(`invoice-row-${y}0001`);
  await expect(row).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectStatValuesVisible(page);

  await row.click();
  await expect(page.getByTestId('totals-total')).toContainText('3 703,68');
  await expectNoHorizontalScroll(page);

  // The action buttons must not sit under any fixed bar.
  await page.getByTestId('mark-paid').click();
  await expect(page.getByTestId('paid-amount')).toBeVisible();
  await page.getByTestId('cancel').click();

  // Escape while typing must not throw the text away; outside a field it closes the dialog.
  await page.getByTestId('send-email').click();
  await page.getByTestId('email-body').fill('Rozpísaný text');
  await page.getByTestId('email-body').press('Escape');
  await expect(page.getByTestId('email-body')).toHaveValue('Rozpísaný text');
  await page.getByRole('dialog').getByRole('heading').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByTestId('nav-new-invoice').click();
  await expect(page).toHaveURL(/\/invoices\/new/);
  await expect(page.getByTestId('item-desc-0')).toBeVisible();
  await expectNoHorizontalScroll(page);
  // The row total and the delete button span the whole item card.
  const [rowWidth, cardWidth] = await page.getByTestId('item-total-0').evaluate((el) => [
    el.parentElement!.getBoundingClientRect().width,
    el.parentElement!.parentElement!.getBoundingClientRect().width,
  ]);
  expect(rowWidth).toBeGreaterThan(cardWidth * 0.8);

  await page.getByTestId('nav-contacts').click();
  await expectNoHorizontalScroll(page);

  await page.getByTestId('nav-settings').click();
  await expectNoHorizontalScroll(page);
  await expect(page.getByTestId('account-logout')).toHaveCSS('color', 'rgb(255, 59, 48)');
  await page.getByTestId('account-logout').click();
  await expect(page).toHaveURL(/\/login/);
});

test('web app manifest and service worker are served', async ({ request }) => {
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBe(true);
  const body = await manifest.json();
  expect(body.display).toBe('standalone');
  // The layout works in landscape and on tablets, so the installed app must be free to rotate.
  expect(body.orientation).toBeUndefined();
  for (const icon of body.icons as { src: string }[]) {
    expect((await request.get(icon.src)).ok()).toBe(true);
  }
  const sw = await request.get('/sw.js');
  expect(sw.headers()['content-type']).toContain('javascript');
});
