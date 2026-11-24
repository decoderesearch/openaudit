'use client';

import { myEvals, type MyEval } from '@/app/runs/actions';
import Link from '@/components/link';
import { LocalTime } from '@/components/local-time';
import { ACTIVE, RunStatusBadge } from '@/components/runs/status-badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

// "My Evals": the viewer's run queue and history in a sidebar. It opens when the viewer enqueues a
// run.

export const MY_EVALS_PATH = '/runs/mine';

/** How often the open sidebar reads the runs again while some wait or run. */
const POLL_MS = 10_000;

type Notice = { title: string; lines: string[] };

type MyEvalsContext = {
  enabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Opens the sidebar with a notice and reads the runs again. */
  announce: (notice: Notice) => void;
  runs: MyEval[] | null;
};

const Context = createContext<MyEvalsContext | null>(null);

export function useMyEvals(): MyEvalsContext {
  const value = useContext(Context);
  if (!value) throw new Error('useMyEvals needs a MyEvalsProvider.');
  return value;
}

const waiting = (r: MyEval) => r.status === 'requested' || ACTIVE.includes(r.status);

/** Gives My Evals to the page, with its sidebar. `enabled`: the viewer can enqueue runs. */
export function MyEvalsProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<MyEval[] | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const load = useCallback(() => {
    myEvals()
      .then(setRuns)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);
  const busy = !!runs?.some(waiting);
  useEffect(() => {
    if (!open || !busy) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [open, busy, load]);

  const value = useMemo<MyEvalsContext>(
    () => ({
      enabled,
      open,
      setOpen: (next) => {
        setOpen(next);
        if (next) load();
        else setNotice(null);
      },
      announce: (n) => {
        setNotice(n);
        setOpen(true);
        load();
      },
      runs,
    }),
    [enabled, open, runs, load],
  );
  return (
    <Context.Provider value={value}>
      {children}
      {enabled && <MyEvalsSheet notice={notice} />}
    </Context.Provider>
  );
}

function MyEvalsSheet({ notice }: { notice: Notice | null }) {
  const { open, setOpen, runs } = useMyEvals();
  const queue = runs?.filter(waiting) ?? [];
  const history = runs?.filter((r) => !waiting(r)) ?? [];
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-slate-200">
          <SheetTitle>My Evals</SheetTitle>
          <SheetDescription>Your queued runs and your history.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {notice && (
            <div className="mb-3 flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CircleCheck className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{notice.title}</p>
                {notice.lines.map((l) => (
                  <p key={l} className="mt-0.5 text-xs text-emerald-800">
                    {l}
                  </p>
                ))}
              </div>
            </div>
          )}
          {runs === null ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <>
              <RunList title={`Queue (${queue.length})`} runs={queue} empty="No runs in the queue." />
              {queue.length > 0 && !notice && (
                <p className="mt-1 text-xs text-slate-500">We will email you when your queued runs finish.</p>
              )}
              <RunList title="History" runs={history} empty="No finished runs yet." />
            </>
          )}
        </div>
        <SheetFooter className="border-t border-slate-200">
          <Button variant="outline" asChild>
            <Link href={MY_EVALS_PATH} onClick={() => setOpen(false)}>
              Open all my evals
            </Link>
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RunList({ title, runs, empty }: { title: string; runs: MyEval[]; empty: string }) {
  const { setOpen } = useMyEvals();
  return (
    <section className="mt-3 first:mt-0">
      <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">{title}</h3>
      {runs.length === 0 ? (
        <p className="mt-1 text-sm text-slate-400">{empty}</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {runs.map((r) => (
            <li key={r.id} className="py-2 text-sm">
              <Link href={r.path} onClick={() => setOpen(false)} className="text-sky-800 hover:underline">
                {r.title}
              </Link>
              <div className="text-xs text-slate-400">{r.settings}</div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <RunStatusBadge status={r.status} />
                {r.progress && <span className="tabular-nums">{r.progress}</span>}
                <LocalTime value={r.createdAt} />
              </div>
              {r.error && <p className="mt-0.5 text-xs text-rose-700">{r.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
