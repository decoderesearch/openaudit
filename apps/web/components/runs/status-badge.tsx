import { cn } from '@/lib/utils';
import type { RunStatus } from '@openaudit/spec';

const STATUS: Record<RunStatus, string> = {
  requested: 'bg-violet-50 text-violet-800',
  queued: 'bg-slate-100 text-slate-600',
  running: 'bg-sky-100 text-sky-800',
  importing: 'bg-sky-100 text-sky-800',
  succeeded: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-rose-100 text-rose-800',
  cancelled: 'bg-amber-100 text-amber-800',
};

export const ACTIVE: RunStatus[] = ['queued', 'running', 'importing'];

export function RunStatusBadge({ status }: { status: RunStatus }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS[status])}>
      {status === 'requested' ? 'waiting for approval' : status}
    </span>
  );
}
