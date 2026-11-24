import { SITE_NAME } from '@/lib/env';
import type { Metadata } from 'next';

/** The site's share image (`app/opengraph-image.tsx`). */
export const SITE_IMAGE = '/opengraph-image';

/** The Open Graph and Twitter tags of a page. Each tag set replaces the layout's, image too, so
 * this gives all of them. `image`: the site's image by default. It also replaces an
 * `opengraph-image` in the page's own folder, so give that image's path. */
export function shareMetadata(
  title: string,
  description: string,
  url: string,
  image = SITE_IMAGE,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const full = `${title} | ${SITE_NAME}`;
  const images = [image];
  return {
    openGraph: { siteName: SITE_NAME, locale: 'en_US', type: 'website', title: full, description, url, images },
    twitter: { card: 'summary_large_image', title: full, description, images },
  };
}

/** "16 OpenAudit evals, 1 flagged chat and 0 safety incidents". */
export function countList(items: [number, string, string][]) {
  const parts = items.map(([n, one, many]) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? '');
}

export const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
