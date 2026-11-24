import { VerdictBar } from '@/components/deploymeter/verdict-bar';
import { VoteHover } from '@/components/deploymeter/vote-hover';
import Link from '@/components/link';
import {
  verdictOf,
  VERDICTS,
  voteOf,
  votesOf,
  voteStyle,
  type DeployVotes,
  type MeterJudge,
  type Vote,
} from '@/lib/deploymeter';
import { cn } from '@/lib/utils';

export const METER_ABOUT = 'How much AI judges trust this model for wide public deployment, from 0 to 100.';

const SPLIT: Vote[] = ['reject', 'limits', 'approve'];

/** The width of a meter's bar; also of an empty slot in its place. */
export const METER_WIDTH = 'w-[61px]';
const LARGE_WIDTH = 'w-[70px]';
const SMALL_WIDTH = 'w-[52px]';

/** The Deploymeter score in its verdict color, above the judges' votes bar. With `judges`, a hover
 * shows the judges of each verdict; with only `votes`, the bar has no hover. `href`: the meter is a
 * link to it. The meter sits above a row link that covers the row. A grey dash with no published
 * panel. `large`: larger, with a wider bar. `small`: smaller, with a narrower bar. `model`: its
 * name, in the hover title. `labeled`: the word "Deploymeter" below the bar. */
export function Meter({
  score,
  judges,
  votes,
  href,
  large,
  small,
  model,
  labeled,
}: {
  score?: number | null;
  judges?: MeterJudge[] | null;
  votes?: DeployVotes | null;
  href?: string;
  large?: boolean;
  small?: boolean;
  model?: string;
  labeled?: boolean;
}) {
  const title =
    score == null ? 'No Deploymeter score' : `Deploymeter: ${score} of 100, ${VERDICTS[verdictOf(score)].label}`;
  const parts = (
    <>
      <span
        className={cn(
          'text-center text-[15px] leading-4 font-extrabold tabular-nums',
          large && 'text-xl leading-5',
          small && 'text-[13px] leading-4',
          score == null ? 'text-slate-400' : VERDICTS[verdictOf(score)].score,
        )}
      >
        {score == null ? '–' : `${score}%`}
      </span>
      <VerdictBar
        votes={judges ? votesOf(judges) : votes}
        className={cn('mt-1 h-1.5', METER_WIDTH, large && ['h-2', LARGE_WIDTH], small && ['mt-0.5 h-1', SMALL_WIDTH])}
      />
      {labeled && (
        <span
          className={cn(
            'mt-0.5 text-[8px] leading-3 font-medium tracking-wide text-slate-400 uppercase',
            large && 'text-[9px]',
          )}
        >
          Deploymeter
        </span>
      )}
    </>
  );
  const active =
    (judges?.length || href) &&
    '-mx-[9px] -my-[7px] cursor-pointer rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-slate-300 hover:bg-slate-100 data-[state=open]:border-slate-300 data-[state=open]:bg-slate-100';
  const meter = href ? (
    <Link href={href} hover={false} aria-label={title} className={cn('flex flex-col', active)}>
      {parts}
    </Link>
  ) : (
    <span aria-hidden className={cn('flex flex-col', active)}>
      {parts}
    </span>
  );
  return (
    <span
      title={judges?.length ? undefined : `${title}\n${METER_ABOUT}`}
      className={cn('flex shrink-0', (judges?.length || href) && 'relative z-10')}
    >
      {judges?.length ? (
        <VoteHover
          trigger={meter}
          side="right"
          className={cn('w-[28rem] px-4 py-3', judges.some((j) => j.score === null) && 'w-[36rem]')}
        >
          <JudgeSplit judges={judges} model={model} />
        </VoteHover>
      ) : (
        meter
      )}
      {!href && <span className="sr-only">{title}</span>}
    </span>
  );
}

/** The counted judges in three columns by verdict, each with its score, and a fourth column when
 * judges abstain. */
function JudgeSplit({ judges, model }: { judges: MeterJudge[]; model?: string }) {
  const split: Vote[] = judges.some((j) => j.score === null) ? [...SPLIT, 'abstain'] : SPLIT;
  return (
    <div className="flex flex-col gap-y-2 text-[11px]">
      <p className="text-center text-[10px] font-bold text-slate-400">
        Deploymeter ratings
        {model && (
          <>
            {' '}
            for <span className="text-slate-600">{model}</span>
          </>
        )}
      </p>
      <div className={cn('grid gap-x-3', split.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
        {split.map((v) => {
          const group = judges.filter((j) => voteOf(j.score) === v);
          return (
            <div key={v} className="flex min-w-0 flex-col gap-y-1">
              <p className={cn('font-bold', voteStyle(v).score)}>
                {voteStyle(v).vote} –{' '}
                <span className="tabular-nums">
                  {group.length} {group.length === 1 ? 'Judge' : 'Judges'}
                </span>
              </p>
              <ul className="flex flex-col gap-y-0.5 text-slate-700">
                {group.map((j) => (
                  <li key={j.name} className="flex justify-between gap-x-2">
                    <span className="truncate">{j.name}</span>
                    {j.score !== null && <span className="text-slate-500 tabular-nums">{j.score}%</span>}
                  </li>
                ))}
                {!group.length && <li className="text-slate-400">None</li>}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
