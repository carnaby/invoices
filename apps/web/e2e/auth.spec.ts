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

test('unreachable API shows an error instead of a blank page', async ({ page }) => {
  await page.route((url) => url.pathname.startsWith('/trpc/') && url.pathname.includes('auth.me'), (route) =>
    route.abort('connectionrefused'),
  );
  await page.goto('/dashboard');
  await expect(page.getByTestId('api-error')).toContainText('Server nie je dostupný');
  await expect(page.getByTestId('api-retry')).toBeVisible();
});

test('closed registration hides the sign-up link and the register form', async ({ page }) => {
  await page.route(
    (url) => url.pathname.startsWith('/trpc/') && url.pathname.includes('auth.registrationEnabled'),
    (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify([{ result: { data: { json: false } } }]) }),
  );
  await page.goto('/login');
  await expect(page.getByTestId('submit')).toBeVisible();
  await expect(page.getByTestId('register-link')).toHaveCount(0);

  await page.goto('/register');
  await expect(page.getByTestId('registration-closed')).toContainText('Registrácia je vypnutá');
  await expect(page.getByTestId('submit')).toHaveCount(0);
});

test('open registration shows the sign-up link', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByTestId('register-link')).toBeVisible();
});
