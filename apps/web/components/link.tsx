import { MethodLink } from '@/components/method-link';
import { ModelLink } from '@/components/model-link';
import { methodPathOf } from '@/lib/methods';
import { modelPathOf } from '@/lib/model-links';
import NextLink from 'next/link';
import type { ComponentProps } from 'react';

/** `next/link` with no prefetch. A prefetch of a dynamic page is a server render, and the click
 * renders the page again, so it only adds load. Set `prefetch` to prefetch one link. A link to a
 * model, method or variant page shows its hover card (`ModelLink`, `MethodLink`); `hover={false}`
 * turns it off. */
export default function Link({
  prefetch = false,
  hover = true,
  ...props
}: ComponentProps<typeof NextLink> & { hover?: boolean }) {
  const href = hover && typeof props.href === 'string' ? props.href : null;
  const path = href && modelPathOf(href);
  if (path) return <ModelLink path={path} prefetch={prefetch} {...props} />;
  const method = href && methodPathOf(href);
  if (method) return <MethodLink path={method} prefetch={prefetch} {...props} />;
  return <NextLink prefetch={prefetch} {...props} />;
}
