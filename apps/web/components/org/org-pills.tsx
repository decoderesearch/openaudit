'use client';

import { ScoreBar } from '@/components/commitments/level-pill';
import Link from '@/components/link';
import { OrgHoverCard, type OrgCards } from '@/components/org/org-hover-card';
import type { Points } from '@/lib/commitments';
import { cn } from '@/lib/utils';

/** One organization pill: its name, linking to its page. `total`: its commitment points, for a bar. */
export type OrgPill = { id: string; name: string; href: string; total?: Points };

/** A strip of organization pills: slate, fully rounded, in up to 3 rows that scroll to the right
 * and fade out at the right edge. The organizations come most prominent first. `bars`: a small
 * commitments bar inside each pill, under the name, with no numbers. */
export function OrgPills({
  orgs,
  onPick,
  bars,
  cards,
  className,
}: {
  orgs: OrgPill[];
  onPick?: () => void;
  bars?: boolean;
  cards?: OrgCards;
  className?: string;
}) {
  if (!orgs.length) return null;
  return (
    <div
      className={cn(
        'no-scrollbar overflow-x-auto overscroll-x-contain [mask-image:linear-gradient(to_right,black_calc(100%-2rem),transparent)]',
        className,
      )}
    >
      <div className="grid auto-cols-max grid-flow-col grid-rows-3 gap-x-1.5 gap-y-1.5 pr-8">
        {orgs.map((o) => (
          <OrgHoverCard key={o.id} org={cards?.[o.href]} onPick={onPick}>
            <Link
              href={o.href}
              onClick={onPick}
              hover={false}
              className={cn(
                'flex flex-col justify-center gap-y-1 rounded-2xl bg-slate-200 px-3.5 text-[11px] font-medium whitespace-nowrap text-slate-600 transition-colors hover:bg-slate-300 hover:text-slate-800',
                bars && o.total ? 'py-1.5' : 'py-0.5',
              )}
            >
              <span>{o.name}</span>
              {bars && o.total && (
                <ScoreBar score={o.total} text="" label={o.name} className="h-1 w-full rounded-full bg-white/70" />
              )}
            </Link>
          </OrgHoverCard>
        ))}
      </div>
    </div>
  );
}
