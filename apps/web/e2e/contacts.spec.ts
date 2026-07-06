import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('contact create, search, edit, delete', async ({ page }) => {
  await registerAndLogin(page);
  await page.getByTestId('nav-contacts').click();
  await page.getByTestId('new-contact').click();

  await page.getByTestId('companyName').fill('Alfa Test s.r.o.');
  await page.getByTestId('ico').fill('12345678');
  await page.getByTestId('city').fill('Martin');
  await page.getByTestId('email').fill('alfa@example.com');
  await page.getByTestId('save').click();
  await expect(page).toHaveURL(/\/contacts$/);
  await expect(page.getByTestId('contact-row-Alfa Test s.r.o.')).toBeVisible();

  await page.getByTestId('search').fill('nenajde-sa');
  await expect(page.getByTestId('contact-row-Alfa Test s.r.o.')).toBeHidden();
  await page.getByTestId('search').fill('alfa');
  await expect(page.getByTestId('contact-row-Alfa Test s.r.o.')).toBeVisible();

  await page.getByTestId('contact-row-Alfa Test s.r.o.').click();
  await page.getByTestId('companyName').fill('Beta Test s.r.o.');
  await page.getByTestId('save').click();
  await expect(page.getByTestId('contact-row-Beta Test s.r.o.')).toBeVisible();

  await page.getByTestId('contact-row-Beta Test s.r.o.').getByTestId('delete-contact').click();
  await page.getByTestId('confirm').click();
  await expect(page.getByTestId('contact-row-Beta Test s.r.o.')).toBeHidden();
});

test('empty company name shows validation error', async ({ page }) => {
  await registerAndLogin(page);
  await page.goto('/contacts/new');
  await page.getByTestId('save').click();
  await expect(page.getByText('Názov firmy je povinný')).toBeVisible();
  await expect(page).toHaveURL(/\/contacts\/new/);
});
