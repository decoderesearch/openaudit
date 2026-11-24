export const WEBSITE_ERROR = 'Website: enter a web address, like example.com.';

// A website as the user typed it, with `https://` added when there is no scheme. '' for empty.
// Null when it is not an http(s) address with a real host (this refuses `javascript:` and others).
export function normalizeWebsite(raw: string): string | null {
  const value = raw.trim();
  if (!value) return '';
  if (/\s/.test(value)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
  const withScheme = hasScheme ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (!/\.([a-z]{2,}|xn--[a-z0-9-]+)$/i.test(url.hostname)) return null;
  return hasScheme ? withScheme.replace(/^[a-z]+/i, (s) => s.toLowerCase()) : withScheme;
}

// A same-site path to go to after sign-in, or the fallback. Refuses other origins.
export function safeReturnTo(value: string | undefined | null, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
