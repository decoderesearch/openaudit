'use client';

import { dateDashed, dateNumeric, dateShort, dateTime } from '@/lib/format';
import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

const FORMATS = { date: dateShort, numeric: dateNumeric, dashed: dateDashed, dateTime };

// The server renders in its own time zone; this re-renders in the browser's after hydration.
export function LocalTime({
  value,
  mode = 'dateTime',
}: {
  value: string | Date | null | undefined;
  mode?: keyof typeof FORMATS;
}) {
  const inBrowser = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  return (
    <span suppressHydrationWarning data-local={inBrowser || undefined}>
      {FORMATS[mode](value)}
    </span>
  );
}
