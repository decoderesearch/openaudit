'use client';

import { commonsThumb, initials, localPhoto } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { OrgDeparture } from '@openaudit/spec';
import { useState } from 'react';

// A departure's Wikimedia Commons photo. The license (CC BY, CC BY-SA) needs a credit: the org
// page shows the credit line; small copies give it on hover and link to the org page.

export type DeparturePhoto = NonNullable<OrgDeparture['image']>;

const photoCredit = (p: DeparturePhoto) => `Photo: ${p.author}, ${p.license}, via Wikimedia Commons`;

/** A round photo, or the initials when there is no photo. `className` sets the size and text size.
 * `large`: a 250 px thumbnail, for a photo wider than 60 px. */
export function Photo({
  photo,
  name,
  large,
  className,
}: {
  photo?: DeparturePhoto;
  name: string;
  large?: boolean;
  className?: string;
}) {
  const width = large ? 250 : 120;
  // Our copy (`scripts/commons-photos.ts`), then the Commons thumbnail, then the initials. 120 and
  // 250 px are standard Commons thumbnail widths, so Commons usually has them in its cache.
  const srcs = photo ? [localPhoto(photo.url, width), commonsThumb(photo.url, width)].filter((s) => s !== null) : [];
  const [failed, setFailed] = useState(0);
  const src = srcs[failed];
  /** Moves to the next source once for each failed source. */
  const fail = () => setFailed((n) => (n === failed ? n + 1 : n));
  if (!photo || !src)
    return (
      <span
        aria-hidden
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-500',
          className,
        )}
      >
        {initials(name)}
      </span>
    );
  return (
    // The image optimizer would need every Commons host in config.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt={`Photo of ${name}`}
      title={photoCredit(photo)}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={fail}
      // It can fail before hydration, with no error event.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) fail();
      }}
      className={cn('shrink-0 rounded-full bg-slate-100 object-cover object-top', className)}
    />
  );
}

/** The credit line, with a link to the Commons file page. */
export function PhotoCredit({ photo }: { photo: DeparturePhoto }) {
  return (
    <p className="text-[10px] leading-tight text-slate-400">
      Photo:{' '}
      <a
        href={photo.pageUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="hover:text-sky-800 hover:underline"
      >
        {photo.author}, {photo.license}, via Wikimedia Commons
      </a>
    </p>
  );
}
