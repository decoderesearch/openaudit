'use client';

import { startRescore } from '@/app/runs/actions';
import { SlotPicker } from '@/components/runs/slot-picker';
import { Button } from '@/components/ui/button';
import type { ModelSlot } from '@openaudit/spec';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'nextjs-toploader/app';
import { useState, useTransition } from 'react';

/** Queues a re-score of this run: the same outputs, scored again with other judges. */
export function RescorePanel({
  runId,
  slots,
  base,
  judges,
}: {
  runId: string;
  slots: ModelSlot[];
  base: Record<string, string>;
  judges: string[];
}) {
  const router = useRouter();
  const [models, setModels] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rescore = () =>
    start(async () => {
      setError(null);
      const result = await startRescore({ runId, models });
      if (result.ok) router.push(result.path);
      else setError(result.error);
    });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-end gap-2">
        <SlotPicker slots={slots} judges={judges} value={models} onChange={setModels} base={base} />
        <Button onClick={rescore} disabled={pending || Object.keys(models).length === 0}>
          <RefreshCw />
          {pending ? 'Queuing…' : 'Re-score'}
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Scores this run&apos;s outputs again with other judges, through OpenRouter. The target model is not called
        again. The re-score is a new run, so you can compare judges.
      </p>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}
