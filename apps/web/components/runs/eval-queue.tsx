'use client';

import { enqueueRuns, type EnqueueResult, type StartRunInput } from '@/app/runs/actions';
import { TopicLine } from '@/components/catalog/parts';
import { EvalLink } from '@/components/eval-link';
import Link from '@/components/link';
import { useMyEvals } from '@/components/my-evals/my-evals';
import { useNewEval } from '@/components/runs/new-eval-context';
import { SignUpDialog } from '@/components/runs/sign-up-dialog';
import { SlotPicker } from '@/components/runs/slot-picker';
import { useQuotes } from '@/components/runs/use-quotes';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { requestKey, samplesText } from '@/lib/runs/batch';
import { shortDuration } from '@/lib/runs/duration';
import { effortLabel, type Effort } from '@/lib/runs/effort';
import { isMissing, type RowState } from '@/lib/runs/eval-table';
import type { EvalRow } from '@/lib/server/eval-table';
import type { RunMode } from '@/lib/server/run-mode';
import type { ItemQuote } from '@/lib/server/run-quotes';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

const STATE: Record<RowState, { text: string; className: string }> = {
  done: { text: 'Done', className: 'bg-emerald-50 text-emerald-800' },
  running: { text: 'Running', className: 'bg-amber-50 text-amber-800' },
  requested: { text: 'Waiting for approval', className: 'bg-violet-50 text-violet-800' },
  partial: { text: 'Partial', className: 'bg-sky-50 text-sky-800' },
  older: { text: 'Older version', className: 'bg-slate-100 text-slate-700' },
  missing: { text: 'Not run', className: 'bg-slate-50 text-slate-500' },
};

/** What a queue control needs to know about the model and the viewer. */
export type QueueContext = {
  modelId: string;
  model: { displayName: string; name: string };
  effort: Effort;
  mode: RunMode;
  /** `request` mode, for guests: the page to sign in on. */
  signInPath: string | null;
  /** The sign-up form's browser check. Null: none. */
  turnstileSiteKey?: string | null;
};

type QueueEval = Pick<EvalRow, 'evalId' | 'displayName' | 'version' | 'slots' | 'defaultLimit'>;

/** The input when its quote lets it queue now, else null. */
const queueable = (ctx: QueueContext, input: StartRunInput, quote: ItemQuote | null | undefined) =>
  !quote?.ok || quote.busyPath || (ctx.mode === 'request' && quote.repeatPath) ? null : input;

/** Queues runs, shows the notice and reloads the page. */
function useEnqueue() {
  const router = useRouter();
  const myEvals = useMyEvals();
  const [sending, start] = useTransition();
  const enqueue = (inputs: StartRunInput[], done?: () => void) =>
    start(async () => {
      const result = await enqueueRuns(inputs).catch(() => ({
        ok: false as const,
        error: 'We could not queue the run. Try again.',
      }));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      myEvals.announce(enqueueNotice(result));
      done?.();
      router.refresh();
    });
  return { enqueue, sending };
}

/** Rows of the Evaluations table for the recommended evals that have no result yet: their state,
 * estimated time and queue button. With no `ctx`, only the state. */
export function MissingEvalRows({ rows, ctx }: { rows: EvalRow[]; ctx: QueueContext | null }) {
  const { enqueue, sending } = useEnqueue();
  return rows.map((r) => {
    const input: StartRunInput = { modelId: ctx?.modelId ?? '', evalId: r.evalId, reasoning: ctx?.effort ?? 'none' };
    const item = ctx && queueable(ctx, input, r.quote);
    const open = isMissing(r.state);
    return (
      <tr key={r.evalId} className="hover:bg-slate-50">
        <td className="px-4 py-2.5 align-middle">
          <EvalLink slug={r.slug} className="text-[13px] font-medium text-sky-800 hover:underline">
            {r.displayName}
          </EvalLink>
          <TopicLine topics={r.topics} />
        </td>
        <td className="px-4 py-2.5 align-middle">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-x-1.5 whitespace-nowrap">
              <span className={cn('rounded px-1.5 py-0.5', STATE[r.state].className)}>
                {STATE[r.state].text}
                {r.limit !== null && r.state !== 'done' && ` (${r.limit})`}
              </span>
              {r.path && (
                <Link href={r.path} className="text-sky-800 hover:underline">
                  View
                </Link>
              )}
            </span>
            {ctx && open && (
              <span className="flex items-center gap-x-2">
                {r.quote?.ok && r.quote.seconds !== null && !r.quote.busyPath && (
                  <span className="whitespace-nowrap text-slate-500" title="Estimated time">
                    {shortDuration(r.quote.seconds)}
                  </span>
                )}
                <QueueCell
                  quote={r.quote}
                  requesting={ctx.mode === 'request'}
                  signInPath={ctx.signInPath}
                  disabled={sending}
                  onQueue={() => item && enqueue([item])}
                />
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  });
}

/** The "New Evaluation" button of the Evaluations section, and its dialog: pick an eval and its
 * settings, see the estimate, then queue the run. A guest gets the sign-up dialog. */
export function NewEvalButton({
  ctx,
  efforts,
  evals,
  judges,
  route,
}: {
  ctx: QueueContext;
  /** How the run reaches the model. */
  route: string;
  /** The efforts a new run can use. `ctx.effort` is the first choice. */
  efforts: Effort[];
  evals: QueueEval[];
  judges: string[];
}) {
  const { enqueue, sending } = useEnqueue();
  const [open, setOpen] = useState(false);
  const [signUp, setSignUp] = useState(false);
  const [evalId, setEvalId] = useState(evals[0]?.evalId ?? '');
  const [effort, setEffort] = useState<Effort>(ctx.effort);
  const [limit, setLimit] = useState('');
  const [models, setModels] = useState<Record<string, string>>({});
  const chosen = evals.find((e) => e.evalId === evalId);
  const input: StartRunInput = {
    modelId: ctx.modelId,
    evalId,
    reasoning: effort,
    limit: limit ? Number(limit) : undefined,
    models: Object.fromEntries(Object.entries(models).filter(([id]) => chosen?.slots.some((s) => s.id === id))),
  };
  const quote = useQuotes(chosen ? [input] : [], open).get(requestKey(input));
  const item = chosen ? queueable(ctx, input, quote) : null;
  const router = useRouter();
  // The toploader router is a new object on each render. Keep it out of the effect deps.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });
  const setOpener = useNewEval()?.setOpen;
  const usable = evals.length > 0;
  const signIn = ctx.signInPath;
  // A topic list's "Queue Run" opens this dialog with its eval chosen, and does not queue it.
  useEffect(() => {
    if (!setOpener) return;
    setOpener(
      signIn
        ? () => setSignUp(true)
        : usable
          ? (id: string) => {
              setEvalId(id);
              setModels({});
              setLimit('');
              setEffort(ctx.effort);
              setOpen(true);
            }
          : null,
    );
    return () => setOpener(null);
  }, [setOpener, signIn, usable, ctx.effort]);

  const trigger = (
    <Button size="xs" className="rounded-full px-2.5 text-[11px] font-semibold has-[>svg]:px-2.5">
      <Plus />
      New Evaluation
    </Button>
  );
  if (ctx.signInPath)
    return (
      <SignUpDialog
        open={signUp}
        onOpenChange={setSignUp}
        returnTo={`/${ctx.model.name}`}
        turnstileSiteKey={ctx.turnstileSiteKey ?? null}
      >
        {trigger}
      </SignUpDialog>
    );
  if (!evals.length) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Evaluation</DialogTitle>
          <DialogDescription>
            Run an eval on {ctx.model.displayName}. Through {route}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Evaluation
            <SelectNative
              value={evalId}
              onChange={(e) => {
                setEvalId(e.target.value);
                setModels({});
              }}
            >
              {evals.map((e) => (
                <option key={e.evalId} value={e.evalId}>
                  {e.displayName} ({e.version})
                </option>
              ))}
            </SelectNative>
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-32 flex-col gap-1 text-xs text-slate-500">
              Thinking
              <SelectNative
                value={effort}
                disabled={efforts.length < 2}
                onChange={(e) => setEffort(e.target.value as Effort)}
              >
                {efforts.map((e) => (
                  <option key={e} value={e}>
                    {effortLabel(e)}
                    {e === ctx.effort ? ' (default)' : ''}
                  </option>
                ))}
              </SelectNative>
            </label>
            <label className="flex w-28 flex-col gap-1 text-xs text-slate-500">
              Samples
              <Input
                inputMode="numeric"
                placeholder={chosen?.defaultLimit ? String(chosen.defaultLimit) : 'All'}
                value={limit}
                onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
                className="h-8 text-xs sm:h-8 md:text-xs"
              />
            </label>
          </div>
          {chosen && chosen.slots.length > 0 && (
            <div className="flex flex-col gap-1">
              <SlotPicker
                slots={chosen.slots}
                judges={judges}
                value={models}
                onChange={setModels}
                target={ctx.model.name}
              />
              <p className="text-[11px] text-slate-500">Other models go through OpenRouter.</p>
            </div>
          )}
          <Estimate
            quote={quote}
            limit={input.limit ?? chosen?.defaultLimit ?? undefined}
            requesting={ctx.mode === 'request'}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!item || sending} onClick={() => item && enqueue([item], () => setOpen(false))}>
            <Plus />
            Queue Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The dialog's estimate: samples and time, or why the run cannot start. */
function Estimate({ quote, limit, requesting }: { quote: ItemQuote | undefined; limit?: number; requesting: boolean }) {
  const box = (child: ReactNode) => <div className="rounded-md bg-slate-50 px-3 py-2 text-xs">{child}</div>;
  if (!quote) return box(<span className="text-slate-400">Getting an estimate…</span>);
  if (!quote.ok) return box(<span className="text-rose-700">{quote.error}</span>);
  if (quote.busyPath)
    return box(
      <Link href={quote.busyPath} className="text-amber-800 hover:underline">
        {quote.busyRequested ? 'This run waits for approval already.' : 'This run is in progress already.'}
      </Link>,
    );
  if (requesting && quote.repeatPath)
    return box(
      <Link href={quote.repeatPath} className="text-slate-600 hover:underline">
        This run ran before. Open it.
      </Link>,
    );
  return box(
    <span className="text-slate-600">
      {limit ? `First ${samplesText(limit)}` : samplesText(quote.samples)}
      {' · '}
      {quote.seconds !== null ? `Estimated time ${shortDuration(quote.seconds)}` : 'No time estimate yet'}
      {requesting && (quote.autoApprove ? ' · Starts at once' : ' · We review it first')}
    </span>,
  );
}

/** A row's quote while it loads, its error, or its busy run. False: the row can act. */
function quoteStatus(quote: ItemQuote | null | undefined): ReactNode | false {
  if (quote === undefined) return <span className="text-slate-400">…</span>;
  if (!quote) return null;
  if (!quote.ok) return <span className="text-rose-700">{quote.error}</span>;
  if (quote.busyPath)
    return (
      <Link
        href={quote.busyPath}
        className={cn('whitespace-nowrap hover:underline', quote.busyRequested ? 'text-violet-800' : 'text-amber-800')}
      >
        {quote.busyRequested ? 'Waiting for approval' : 'Running now'}
      </Link>
    );
  return false;
}

/** The sidebar notice after the viewer enqueues runs. */
function enqueueNotice(r: Extract<EnqueueResult, { ok: true }>) {
  const n = r.queued + r.waiting;
  const lines = [
    ...(r.waiting && r.queued ? [`${r.queued} start now. ${r.waiting} wait for us to review them.`] : []),
    ...(r.waiting && !r.queued
      ? [n === 1 ? 'We review it before it starts.' : 'We review them before they start.']
      : []),
    ...(r.repeats ? [`We skipped ${r.repeats} that ran before or are in the queue.`] : []),
    'We will email you when your queued runs finish.',
  ];
  return { title: n === 1 ? 'Run queued successfully.' : `${n} runs queued successfully.`, lines };
}

/** The queue button of a row: queue the run, sign in first, or why not. */
function QueueCell({
  quote,
  requesting,
  signInPath,
  disabled,
  onQueue,
}: {
  quote: ItemQuote | null | undefined;
  /** A user's request: it can repeat no earlier run, and it can wait for review. */
  requesting: boolean;
  signInPath: string | null;
  disabled: boolean;
  onQueue: () => void;
}) {
  const status = quoteStatus(quote);
  if (status !== false) return status;
  if (requesting && quote?.ok && quote.repeatPath)
    return (
      <Link href={quote.repeatPath} className="whitespace-nowrap text-slate-500 hover:underline">
        Ran before
      </Link>
    );
  const child = (
    <>
      <Plus />
      Queue Run
    </>
  );
  return (
    <div className="flex flex-col items-end gap-0.5">
      {signInPath ? (
        <Button size="xs" asChild className="whitespace-nowrap">
          <Link href={signInPath}>{child}</Link>
        </Button>
      ) : (
        <Button size="xs" disabled={disabled} onClick={onQueue} className="whitespace-nowrap">
          {child}
        </Button>
      )}
      {requesting && quote?.ok && (
        <span className="text-[10px] whitespace-nowrap text-slate-400">
          {quote.autoApprove ? 'Starts at once' : 'We review it first'}
        </span>
      )}
    </div>
  );
}
