import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';
import { Client } from 'pg';
import { NOTICE_KEY } from '../lib/first-visit';

// Collects console errors and page errors; each test fails if any appear, except those that
// match `allowConsole`. Unless `noticeSeen` is false, the first-visit notice does not show.
export const test = base.extend<{ allowConsole: RegExp[]; consoleErrors: string[]; noticeSeen: boolean }>({
  allowConsole: [[], { option: true }],
  noticeSeen: [true, { option: true }],
  page: async ({ page, noticeSeen }, use) => {
    if (noticeSeen) await page.addInitScript((key) => localStorage.setItem(key, '1'), NOTICE_KEY);
    await use(page);
  },
  consoleErrors: async ({ page, allowConsole }, use) => {
    const errors: string[] = [];
    const keep = (text: string) => {
      if (!allowConsole.some((re) => re.test(text))) errors.push(text);
    };
    page.on('console', (msg) => {
      if (msg.type() === 'error') keep(msg.text());
    });
    page.on('pageerror', (err) => keep(err.message));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  },
});

export { expect };

// The checks every page must pass: no horizontal overflow and no serious axe violations.
export async function expectPageOk(page: Page) {
  await page.waitForLoadState('networkidle');
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'horizontal overflow').toBeLessThanOrEqual(innerWidth);
  // `#nprogress`: the top loader's bar, with a role that the package sets.
  const axe = await new AxeBuilder({ page }).exclude('nextjs-portal').exclude('#nprogress').analyze();
  const serious = axe.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .flatMap((v) =>
      v.nodes.map((n) => `${v.id}: ${n.html.slice(0, 160)} (${n.failureSummary?.split('\n')[1]?.trim()})`),
    );
  expect(serious, 'axe violations').toEqual([]);
}

// Asks for a sign-in link for `email` and returns the confirm-page URL the email would hold. The
// token comes from the test database instead of the email.
export async function signInLink(page: Page, email: string, returnTo = '/') {
  const newUserCallbackURL = `/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
  const res = await page.request.post('/api/auth/sign-in/magic-link', {
    data: { email, callbackURL: returnTo, newUserCallbackURL },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  let token: string | undefined;
  try {
    const { rows } = await client.query<{ identifier: string }>(
      `SELECT identifier FROM verification WHERE value LIKE $1 ORDER BY "createdAt" DESC LIMIT 1`,
      [`%"${email}"%`],
    );
    token = rows[0]?.identifier;
  } finally {
    await client.end();
  }
  expect(token, 'magic-link token').toBeTruthy();
  return `/signin/confirm?${new URLSearchParams({ token: token!, callbackURL: returnTo, newUserCallbackURL })}`;
}

// Signs in as `email` the way a person does: open the link from the email, press "Sign in".
export async function signIn(page: Page, email: string, returnTo = '/') {
  await page.goto(await signInLink(page, email, returnTo));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL((url) => url.pathname !== '/signin/confirm');
}

// A unique email and username per test, so parallel tests do not share accounts.
export function uniqueUser(prefix: string) {
  const n = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { email: `${prefix}-${n}@example.org`, username: `${prefix}_${n}`.slice(0, 30) };
}
