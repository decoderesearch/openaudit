/** The top-level routes of `app/` with a fixed name. Any other `/<owner>/<repo>` is a model page. */
export const TOP_ROUTES = new Set([
  'admin',
  'api',
  'attempts',
  'contribute',
  'evaluations',
  'faqs',
  'features',
  'files',
  'judges',
  'llms.txt',
  'methods',
  'models',
  'onboarding',
  'organizations',
  'privacy',
  'robots.txt',
  'runs',
  'samples',
  'settings',
  'signin',
  'submit',
  'terms',
  'topics',
  'updates',
]);

/** A placeholder for a model with no public name (`openai/unreleased-hf-hack`,
 * `openai/unknown-medicare-agent`). It has no page to link to. */
export const isPlaceholderModel = (name: string) => /^[^/]+\/(unreleased|unknown)-/.test(name);

/** The routes of `app/[owner]/` with a fixed name. */
export const OWNER_ROUTES = new Set(['commitments', 'departures', 'incidents', 'models']);

/** The model path of a link to a model page (`/<owner>/<repo>`, with a query or anchor), decoded
 * and in lower case, else null. */
export function modelPathOf(href: string): string | null {
  const m = href.match(/^\/([^/#?]+)\/([^/#?]+)\/?(?:[#?].*)?$/);
  if (!m || TOP_ROUTES.has(m[1]) || OWNER_ROUTES.has(m[2])) return null;
  try {
    return decodeURIComponent(`/${m[1]}/${m[2]}`).toLowerCase();
  } catch {
    return null;
  }
}
