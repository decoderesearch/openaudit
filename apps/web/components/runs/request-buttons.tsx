'use client';

import { approveRunsAction, declineRunAction } from '@/app/admin/runs/actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

const small = 'h-6 px-2 text-[11px]';

/** Admins only. Moves requested runs to the queue. With `confirm`, asks first. */
export function ApproveButton({ runIds, label, confirm }: { runIds: string[]; label: string; confirm?: string }) {
  const [pending, start] = useTransition();
  const approve = () => {
    if (confirm && !window.confirm(confirm)) return;
    start(async () => {
      const result = await approveRunsAction(runIds);
      if (result.ok)
        toast.success(result.approved === 1 ? 'Run approved and queued.' : `${result.approved} runs queued.`);
      else toast.error(result.error);
    });
  };
  return (
    <Button size="sm" className={small} disabled={pending} onClick={approve}>
      {pending ? 'Approving…' : label}
    </Button>
  );
}

/** Admins only. Asks first, then declines the request. */
export function DeclineButton({ runId, label }: { runId: string; label: string }) {
  const [pending, start] = useTransition();
  const decline = () => {
    if (!window.confirm(`Decline this request?\n\n${label}\n\nThe run is cancelled, and the owner gets an email.`))
      return;
    start(async () => {
      const result = await declineRunAction(runId);
      if (result.ok) toast.success('Request declined.');
      else toast.error(result.error);
    });
  };
  return (
    <Button variant="outline" size="sm" className={small} disabled={pending} onClick={decline}>
      {pending ? 'Declining…' : 'Decline'}
    </Button>
  );
}
