'use client';

import { cancelRunAction } from '@/app/admin/runs/actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Asks first, then cancels the run. */
export function CancelRunButton({ runId, label }: { runId: string; label: string }) {
  const [pending, start] = useTransition();
  const cancel = () => {
    if (!window.confirm(`Cancel this run?\n\n${label}\n\nIts status becomes "cancelled", and the owner gets an email.`))
      return;
    start(async () => {
      const result = await cancelRunAction(runId);
      if (result.ok) toast.success('Run cancelled.');
      else toast.error(result.error);
    });
  };
  return (
    <Button variant="outline" size="sm" className="h-6 px-2 text-[11px]" disabled={pending} onClick={cancel}>
      {pending ? 'Cancelling…' : 'Cancel'}
    </Button>
  );
}
