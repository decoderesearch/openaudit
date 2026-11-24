import { ACTION } from '@/components/catalog/model-actions';
import { VoteHover } from '@/components/deploymeter/vote-hover';
import { Markdown } from '@/components/markdown';
import { ShowAllList } from '@/components/methods/show-all-list';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { formatDate } from '@/lib/org-research';
import { cn } from '@/lib/utils';
import type { ExpertStance, MethodExpertView } from '@openaudit/spec';
import { ChevronRight, Info } from 'lucide-react';
import type { ReactNode } from 'react';

/** `count`: the color of a nonzero count; `bar`: its part of the stance bar. */
const STANCE: Record<ExpertStance, { label: string; count: string; bar: string }> = {
  positive: { label: 'Positive', count: 'text-emerald-600', bar: 'bg-emerald-500' },
  mixed: { label: 'Mixed', count: 'text-amber-600', bar: 'bg-amber-400' },
  negative: { label: 'Negative', count: 'text-rose-600', bar: 'bg-rose-500' },
};

const STANCES = Object.keys(STANCE) as ExpertStance[];

export const HEAD = 'text-[10px] font-semibold tracking-wide text-slate-600 uppercase';

/** A titled part of a Details modal. */
export function MoreSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-y-2">
      <h3 className={HEAD}>{title}</h3>
      <div className="pl-4">{children}</div>
    </section>
  );
}

/** A top-right button that opens `children` in a modal titled `title`. */
function ModalButton({
  icon,
  text,
  title,
  about,
  children,
}: {
  icon: ReactNode;
  text: string;
  title: string;
  about: string;
  children: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger className={ACTION}>
        {icon}
        {text}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-y-4 bg-white sm:max-w-3xl">
        <DialogTitle className="pr-8 text-base">{title}</DialogTitle>
        <DialogDescription className="sr-only">{about}</DialogDescription>
        <div className="-mx-6 flex min-h-0 flex-1 flex-col gap-y-5 overflow-y-auto overscroll-contain border-t border-slate-100 px-6 pt-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** A top-right button that opens `children` in a modal with more about `label`. */
export function DetailsButton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ModalButton icon={<Info aria-hidden />} text="Details" title={`Details: ${label}`} about={`More about ${label}.`}>
      {children}
    </ModalButton>
  );
}

/**
 * The expert views: `summary`, then a count for each stance and, below it, its views (3, then
 * "Show all"). A hover on a view shows its summary. With no `views`, nothing.
 */
export function ExpertJudges({ summary, views }: { summary?: string; views: MethodExpertView[] }) {
  const by = Object.fromEntries(STANCES.map((s) => [s, views.filter((v) => v.stance === s)])) as Record<
    ExpertStance,
    MethodExpertView[]
  >;
  return (
    <div className="flex min-w-0 flex-col gap-y-3">
      {views.length > 0 && (
        <div className="flex flex-col gap-y-3">
          {summary && <p className="text-[13px] leading-snug font-medium text-slate-700">{summary}</p>}
          <div className="flex flex-col gap-y-1 pt-1.5">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200" aria-hidden>
              {STANCES.map((s) => (
                <span key={s} className={STANCE[s].bar} style={{ flexGrow: by[s].length }} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-x-4">
              {STANCES.map((s) => (
                <div key={s} className="flex min-w-0 flex-col gap-y-1">
                  <p className="flex items-baseline gap-x-1.5 py-1">
                    <span
                      className={cn(
                        'text-base/tight font-bold tabular-nums',
                        by[s].length ? STANCE[s].count : 'text-slate-300',
                      )}
                    >
                      {by[s].length}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                      {STANCE[s].label}
                    </span>
                  </p>
                  {by[s].length > 0 && (
                    <ShowAllList
                      className="flex flex-col gap-y-0.5"
                      items={by[s].map((v) => (
                        <ViewItem key={v.id} view={v} />
                      ))}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** One view in a stance column: its title. A hover shows its author, date and summary. */
function ViewItem({ view: v }: { view: MethodExpertView }) {
  return (
    <VoteHover
      trigger={
        <li
          tabIndex={0}
          className="-mx-1.5 flex items-start gap-x-0.5 rounded-md py-0.5 pr-1.5 pl-2.5 text-[11px] leading-tight outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-600/40"
        >
          <ChevronRight aria-hidden className="mt-px size-3 shrink-0 text-slate-400" />
          <span className="line-clamp-2 min-w-0 font-normal text-slate-500">{v.title}</span>
        </li>
      }
      className="flex max-h-[min(32rem,var(--radix-hover-card-content-available-height))] w-[24rem] flex-col gap-y-1 overflow-y-auto overscroll-contain px-4 py-3 text-left text-xs"
    >
      <span className="text-[11px] text-slate-500">
        <ViewAuthor view={v} /> · {formatDate(v.publishedDate)}
      </span>
      <span className="font-semibold text-slate-800">{v.title}</span>
      <Markdown text={v.summary} className="text-slate-700" />
    </VoteHover>
  );
}

/** The view's organization, else its authors, as a link to its first source in a new tab.
 * `className`: for example, a text color for the link. */
function ViewAuthor({ view: v, className }: { view: MethodExpertView; className?: string }) {
  const name = v.organization || v.byline;
  const url = v.sources[0]?.url;
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer nofollow"
      className={cn('font-semibold text-sky-800 hover:underline', className)}
    >
      {name}
    </a>
  ) : (
    <span className={cn('font-semibold text-slate-700', className)}>{name}</span>
  );
}
