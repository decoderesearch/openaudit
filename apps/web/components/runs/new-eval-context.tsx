'use client';

import type { RowState } from '@/lib/runs/eval-table';
import type { Topic } from '@openaudit/spec';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

/** A recommended eval that the shown OpenAudit version has no result of. */
export type NotRunEval = { evalId: string; slug: string; displayName: string; topics: Topic[]; state: RowState };

type NewEval = {
  /** Empty until the Evaluations section loads. */
  evals: NotRunEval[];
  setEvals: (evals: NotRunEval[]) => void;
  /** Opens the "New Evaluation" dialog with the eval chosen. Null: the viewer cannot queue runs here. */
  open: ((evalId: string) => void) | null;
  setOpen: (open: ((evalId: string) => void) | null) => void;
};

const NewEvalContext = createContext<NewEval | null>(null);

/** Lets the topic lists of a model page show the evals not run yet, and open the "New Evaluation"
 * dialog of the Evaluations section. */
export function NewEvalProvider({ children }: { children: ReactNode }) {
  const [evals, setEvals] = useState<NotRunEval[]>([]);
  const [open, setOpenState] = useState<((evalId: string) => void) | null>(null);
  const setOpen = useCallback((f: ((evalId: string) => void) | null) => setOpenState(() => f), []);
  const value = useMemo(() => ({ evals, setEvals, open, setOpen }), [evals, open, setOpen]);
  return <NewEvalContext.Provider value={value}>{children}</NewEvalContext.Provider>;
}

/** Null outside a `NewEvalProvider`. */
export const useNewEval = () => useContext(NewEvalContext);

/** Gives the evals not run yet to the page's `NewEvalProvider`. Shows nothing. */
export function NotRunEvals({ evals }: { evals: NotRunEval[] }) {
  const setEvals = useNewEval()?.setEvals;
  useEffect(() => {
    if (!setEvals) return;
    setEvals(evals);
    return () => setEvals([]);
  }, [setEvals, evals]);
  return null;
}
