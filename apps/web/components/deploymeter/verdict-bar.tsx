import { voteStyle, type DeployVotes, type Vote } from '@/lib/deploymeter';
import { cn } from '@/lib/utils';
import { Fragment, type CSSProperties, type ReactNode } from 'react';

const ORDER: Vote[] = ['reject', 'limits', 'approve', 'abstain'];

/** The judges' votes as one bar: red, amber, emerald, then slate (abstain), each part as wide as
 * its votes. Empty with no votes. `part`: makes each part from its class and style, for example
 * with a hover. */
export function VerdictBar({
  votes,
  className,
  part,
}: {
  votes?: DeployVotes | null;
  className?: string;
  part?: (vote: Vote, n: number, bar: { className: string; style: CSSProperties }) => ReactNode;
}) {
  return (
    <span className={cn('flex h-2 overflow-hidden rounded-full bg-slate-100', className)}>
      {ORDER.map((v) => {
        const n = votes?.[v] ?? 0;
        if (n === 0) return null;
        const bar = { className: voteStyle(v).bar, style: { flex: n } };
        return part ? <Fragment key={v}>{part(v, n, bar)}</Fragment> : <span key={v} {...bar} />;
      })}
    </span>
  );
}
