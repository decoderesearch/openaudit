// Organization pages live at `/<slug>`. Other slugs (old slugs, other model owners) and other
// letter cases redirect there.

/** Top-level folders in `app/`. A static route wins over `/<slug>`, so no slug may be one. */
export const TOP_LEVEL_ROUTES = new Set([
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

export type OrganizationSlugs = { slug: string; slugAliases: string[] };

/** The page path of an organization. */
export function organizationPath(o: Pick<OrganizationSlugs, 'slug'>) {
  return `/${o.slug}`;
}

/** The lookup key for a raw path segment: decoded and lowercase. Null when it cannot be a slug. */
export function slugKey(segment: string): string | null {
  let s: string;
  try {
    s = decodeURIComponent(segment);
  } catch {
    return null;
  }
  s = s.toLowerCase();
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s) && s.length <= 64 ? s : null;
}

/**
 * What a raw path segment shows: the page of `org` when the segment is its slug, else a redirect
 * to that page (an alias or another letter case), or null when no organization has the name.
 */
export function resolveOrganization<T extends OrganizationSlugs>(
  segment: string,
  orgs: T[],
): { org: T; redirect: boolean } | null {
  const key = slugKey(segment);
  if (!key) return null;
  const org = orgs.find((o) => o.slug === key) ?? orgs.find((o) => o.slugAliases.includes(key));
  return org ? { org, redirect: segment !== org.slug } : null;
}
