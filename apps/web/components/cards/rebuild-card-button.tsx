'use client';

import { rebuildCardAction } from '@/app/admin/cards/actions';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Rebuild saves a new draft only when the input changed; Force always does. */
export function RebuildCardButtons({ modelId, label }: { modelId: string; label: string }) {
  const [pending, start] = useTransition();
  const ask = (force: boolean) => {
    const text = force
      ? `Build a new card draft for ${label}, also if its input did not change?\n\nThe writer model costs about $0.30. You preview the draft, then publish it.`
      : `Rebuild the card for ${label}?\n\nIt saves a new draft only when its runs, snippets or prompt changed. You preview the draft, then publish it.`;
    if (!window.confirm(text)) return;
    start(async () => {
      const result = await rebuildCardAction(modelId, force);
      if (result.ok) toast.success('Rebuild queued.');
      else toast.error(result.error);
    });
  };
  const cls = 'h-6 px-2 text-[11px]';
  return (
    <div className="flex gap-1.5">
      <Button variant="outline" size="sm" className={cls} disabled={pending} onClick={() => ask(false)}>
        {pending ? 'Queuing…' : 'Rebuild'}
      </Button>
      <Button variant="outline" size="sm" className={cls} disabled={pending} onClick={() => ask(true)}>
        Force
      </Button>
    </div>
  );
}
