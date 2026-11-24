import type { Page } from '@playwright/test';
import { expect, expectPageOk, signIn, test, uniqueUser } from './helpers';

const atPath = (path: string) => (url: URL) => url.pathname === path;

// The browser logs the 400 that refuses a taken handle.
test.use({ allowConsole: [/status of 400/] });

test('sign in, pick a username, then go on to Settings', async ({ page, isMobile, consoleErrors: _ }) => {
  const user = uniqueUser('e2e');
  await signIn(page, user.email, '/settings');

  await expect(page).toHaveURL(atPath('/onboarding'));
  await expectPageOk(page);
  const form = page.locator('form');
  await expect(page.getByLabel('Username')).toHaveValue(user.username);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Name', { exact: true }).fill('E2E User');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(form.getByRole('alert')).toHaveText('Username: This name is reserved.');
  await page.getByLabel('Username').fill(user.username);
  await page.getByLabel('Website (optional)').fill('example.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page).toHaveURL(atPath('/settings'));
  await expect(page.getByLabel('Username')).toHaveValue(user.username);
  await expect(page.getByLabel('Website (optional)')).toHaveValue('https://example.com');
  if (!isMobile) {
    await expect(page.getByRole('banner').getByRole('button', { name: 'Account' })).toBeVisible();
  }
  await expectPageOk(page);

  // The API checks the website too, for callers that skip the form.
  const bad = await page.request.post('/api/auth/update-user', { data: { website: 'javascript:alert(1)' } });
  expect(bad.status()).toBe(400);
});

// The account menu is in the top bar at all widths.
async function pickAccountLink(page: Page, label: string) {
  await page.getByRole('banner').getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

test('the account menu leads back to onboarding, then to Settings', async ({ page }) => {
  const user = uniqueUser('e2emenu');
  await signIn(page, user.email, '/');
  await expect(page).toHaveURL(atPath('/onboarding'));

  await page.goto('/');
  await pickAccountLink(page, 'Finish sign-up');
  await expect(page).toHaveURL(atPath('/onboarding'));

  await page.getByLabel('Name', { exact: true }).fill('E2E Menu User');
  await page.getByLabel('Affiliation (optional)').fill('E2E University');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page).toHaveURL(atPath('/'));

  await pickAccountLink(page, 'Settings');
  await expect(page).toHaveURL(atPath('/settings'));
  await expectPageOk(page);
});
