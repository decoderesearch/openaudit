'use client';

import { acceptTerms } from '@/app/runs/actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'nextjs-toploader/app';
import { useState, useTransition } from 'react';

export function AcceptTerms({ versionId, termsSha256 }: { versionId: string; termsSha256: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const accept = () =>
    start(async () => {
      setError(null);
      const result = await acceptTerms({ versionId, termsSha256 });
      if (result.ok) router.refresh();
      else setError(result.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button onClick={accept} disabled={pending}>
        {pending ? 'Saving…' : 'I accept these terms'}
      </Button>
      {error && <span className="text-xs text-rose-700">{error}</span>}
    </div>
  );
}
