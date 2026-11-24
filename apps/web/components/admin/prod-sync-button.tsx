'use client';

import { syncToProdAction } from '@/app/admin/sync/actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Writes to the production database after a confirm. */
export function ProdSyncButton({
  runs,
  attempts,
  versions,
  panels,
}: {
  runs: number;
  attempts: number;
  versions: number;
  panels: number;
}) {
  const [pending, start] = useTransition();
  const none = runs + versions + panels === 0;
  const ask = () => {
    const text =
      `Copy ${runs} runs (${attempts.toLocaleString()} attempts), ${versions} card versions and ${panels} Deploymeter panels to production?\n\n` +
      'This writes to the production database, in one transaction.';
    if (!window.confirm(text)) return;
    start(async () => {
      const r = await syncToProdAction();
      if (r.ok)
        toast.success(
          `Synced ${r.result.runs} runs, ${r.result.attempts.toLocaleString()} attempts, ${r.result.versions} card versions, ${r.result.panels} Deploymeter panels.`,
        );
      else toast.error(r.error, { duration: 15000 });
    });
  };
  return (
    <Button size="sm" disabled={pending || none} onClick={ask}>
      {pending ? 'Syncing…' : none ? 'Nothing to sync' : 'Sync to production'}
    </Button>
  );
}
