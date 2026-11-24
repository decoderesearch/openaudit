import { expect, expectPageOk, signInLink, test, uniqueUser } from './helpers';

test.describe('sign-in link', () => {
  test('opening the link changes nothing; only "Sign in" uses it', async ({ page, consoleErrors: _ }) => {
    const user = uniqueUser('e2e');
    const link = await signInLink(page, user.email, '/settings');

    // A mail scanner opens the link twice. The token still works after that.
    await page.goto(link);
    await page.goto(link);
    await expect(page.getByText(user.email)).toBeVisible();
    await expectPageOk(page);

    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/onboarding');

    // The token works once.
    await page.goto(link);
    await expect(page.getByText('This link does not work')).toBeVisible();
  });

  test('a bad token shows a way to get a new link', async ({ page, consoleErrors: _ }) => {
    await page.goto('/signin/confirm?token=nope');
    await expect(page.getByText('This link does not work')).toBeVisible();
    await page.getByRole('link', { name: 'Get a new link' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/signin');
  });
});
