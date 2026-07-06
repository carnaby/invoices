import { expect, test } from '@playwright/test';
import { registerAndLogin, uniqueUser } from './helpers';

test('register → dashboard → logout → login', async ({ page }) => {
  const username = await registerAndLogin(page);
  await expect(page.getByTestId('nav-user')).toContainText(username);

  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill('password123');
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('login with wrong password shows Slovak error', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('username').fill(uniqueUser());
  await page.getByTestId('password').fill('wrong-password');
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('form-error')).toContainText('Nesprávne meno alebo heslo');
});

test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
