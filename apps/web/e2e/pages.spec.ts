import { expect, expectPageOk, test } from './helpers';

test.describe('public pages', () => {
  for (const path of ['/', '/signin', '/methods', '/topics']) {
    test(`${path} renders`, async ({ page, consoleErrors: _ }) => {
      await page.goto(path);
      await expect(page.locator('h1, [data-slot="card-title"]').first()).toBeVisible();
      await expectPageOk(page);
    });
  }

  test('signed-in pages send a visitor to sign in', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(
      (url) => url.pathname === '/signin' && url.searchParams.get('returnTo') === '/settings',
    );
  });

  test('the top bar reaches sign in', async ({ page, consoleErrors: _ }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/signin');
  });
});

test.describe('first-visit notice', () => {
  test.use({ noticeSeen: false });

  test('shows once, until "I Understand"', async ({ page, consoleErrors: _ }) => {
    await page.goto('/');
    const notice = page.getByRole('dialog', { name: 'Before Proceeding' });
    await expect(notice).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: 'I Understand' }).click();
    await expect(notice).toBeHidden();
    await page.goto('/methods');
    await page.waitForLoadState('networkidle');
    await expect(notice).toBeHidden();
  });

  test('a tutorial link opens the walkthrough after the notice', async ({ page, consoleErrors: _ }) => {
    await page.goto('/?tutorial');
    const walkthrough = page.getByRole('dialog', { name: 'Guided Walkthrough' });
    await page.getByRole('dialog', { name: 'Before Proceeding' }).getByRole('button', { name: 'I Understand' }).click();
    await expect(walkthrough).toBeVisible();
    await expect(walkthrough.getByRole('img', { name: 'OpenAudit' })).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '');
  });
});

test.describe('tutorial link', () => {
  test('/?tutorial opens the walkthrough', async ({ page, consoleErrors: _ }) => {
    await page.goto('/?tutorial');
    await expect(page.getByRole('dialog', { name: 'Guided Walkthrough' })).toBeVisible();
    await expect(page).toHaveURL((url) => url.search === '');
  });
});

test.describe('not found', () => {
  // The browser logs the page's own 404 status.
  test.use({ allowConsole: [/status of 404/] });

  test('an unknown path is a 404 page', async ({ page, consoleErrors: _ }) => {
    const res = await page.goto('/no-such-page');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Not found' })).toBeVisible();
    await expectPageOk(page);
  });
});
