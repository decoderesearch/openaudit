'use client';

import { SEVERITY_COLORS } from '@/lib/openaudit-card';
import type { PassFilter } from '@/lib/runs/model-passes';
import { cn } from '@/lib/utils';
import { Check, X } from 'lucide-react';
import { createContext, useContext, useState, type ReactNode } from 'react';

const PassFilterContext = createContext<{ filter: PassFilter | null; set: (f: PassFilter | null) => void } | null>(
  null,
);

/** Keeps the pass filter that `PassTally` sets and the sample's table reads. */
export function PassFilterProvider({ children }: { children: ReactNode }) {
  const [filter, set] = useState<PassFilter | null>(null);
  return <PassFilterContext.Provider value={{ filter, set }}>{children}</PassFilterContext.Provider>;
}

/** The pass filter. Null: no filter, or no provider. */
export function usePassFilter() {
  return useContext(PassFilterContext)?.filter ?? null;
}

const plural = (n: number) => `${n} Model${n === 1 ? '' : 's'}`;

const KINDS = [
  {
    key: 'passed',
    label: 'Passed',
    Icon: Check,
    color: 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
    on: 'ring-emerald-600',
  },
  {
    key: 'failed',
    label: 'Failed',
    Icon: X,
    color: cn('bg-red-50 hover:bg-red-100', SEVERITY_COLORS.high.text),
    on: 'ring-red-700',
  },
] as const;

/** How many models passed and failed. A click on one shows only those models; a second click
 * shows all again. */
export function PassTally({ passed, failed }: { passed: number; failed: number }) {
  const ctx = useContext(PassFilterContext);
  const counts = { passed, failed };
  return (
    <div className="flex shrink-0 flex-col gap-y-1 text-[11px] font-semibold tracking-wide uppercase">
      {KINDS.map(({ key, label, Icon, color, on }) => {
        const active = ctx?.filter === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={active}
            title={active ? 'Show all models' : `Show only the models that ${label.toLowerCase()}`}
            onClick={() => ctx?.set(active ? null : key)}
            className={cn(
              'flex cursor-pointer items-center gap-x-1 rounded-md px-2 py-1 uppercase transition-colors',
              color,
              active && cn('ring-1', on),
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {plural(counts[key])} {label}
          </button>
        );
      })}
    </div>
  );
}
