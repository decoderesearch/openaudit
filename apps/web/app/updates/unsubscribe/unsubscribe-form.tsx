'use client';

import { unsubscribeAction } from '@/app/updates/actions';
import { Button } from '@/components/ui/button';
import { useState, useTransition } from 'react';

export default function UnsubscribeForm({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<'idle' | 'done' | string>('idle');
  if (state === 'done')
    return <p className="rounded-md bg-emerald-50 p-3 text-emerald-900">Done. We will send no more update emails.</p>;
  return (
    <div className="flex flex-col gap-2">
      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await unsubscribeAction(token);
            setState(result.ok ? 'done' : result.error);
          })
        }
      >
        {pending ? 'Saving…' : 'Unsubscribe'}
      </Button>
      {state !== 'idle' && <p className="text-red-600">{state}</p>}
    </div>
  );
}
