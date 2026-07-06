import { expect, type Page } from '@playwright/test';

export function uniqueUser() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}
export async function registerAndLogin(page: Page): Promise<string> {
  const username = uniqueUser();
  await page.goto('/register');
  await page.getByTestId('username').fill(username);
  await page.getByTestId('password').fill('password123');
  await page.getByTestId('submit').click();
  await expect(page).toHaveURL(/\/dashboard/);
  return username;
}
