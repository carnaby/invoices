import { expect, test } from '@playwright/test';
import { registerAndLogin } from './helpers';

test('account password change: wrong current password errors, correct change lets login with new password only', async ({
  page,
}) => {
  const username = await registerAndLogin(page);
  await page.getByTestId('nav-settings').click();

  await page.getByTestId('currentPassword').fill('wrong-password');
  await page.getByTestId('newPassword').fill('newpassword456');
  await page.getByTestId('save-password').click();
  await expect(page.getByTestId('password-error')).toContainText('Nesprávne aktuálne heslo');

  await page.getByTestId('currentPassword').fill('password123');
  await page.getByTestId('newPassword').fill('newpassword456');
  await page.getByTestId('save-password').click();
  await expect(page.getByTestId('password-changed')).toContainText('Heslo bolo zmenené');
  await expect(page.getByTestId('currentPassword')).toHaveValue('');
  await expect(page.getByTestId('newPassword')).toHaveValue('');

  await page.getByTestId('logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill('password123');
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('form-error')).toContainText('Nesprávne meno alebo heslo');

  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill('newpassword456');
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
});
