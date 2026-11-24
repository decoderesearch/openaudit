'use client';

import { reviewCardVersionAction, type RebuildResult } from '@/app/admin/cards/actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'nextjs-toploader/app';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Publish shows the draft to all; Discard keeps the published version. `review`: the
 * server action, for a card that is not an OpenAudit. */
export function ReviewCardButtons({
  versionId,
  label,
  review = reviewCardVersionAction,
}: {
  versionId: string;
  label: string;
  review?: (versionId: string, publish: boolean) => Promise<RebuildResult>;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (publish: boolean) => {
    const text = publish
      ? `Publish ${label}? All visitors then see this version.`
      : `Discard ${label}? The public keeps the published version. A build makes a new draft only when the input changes, or with Force.`;
    if (!window.confirm(text)) return;
    start(async () => {
      const result = await review(versionId, publish);
      if (!result.ok) return void toast.error(result.error);
      toast.success(publish ? 'Published.' : 'Discarded.');
      router.refresh();
    });
  };
  const cls = 'h-6 px-2 text-[11px]';
  return (
    <div className="flex gap-1.5">
      <Button size="sm" className={cls} disabled={pending} onClick={() => act(true)}>
        Publish
      </Button>
      <Button variant="outline" size="sm" className={cls} disabled={pending} onClick={() => act(false)}>
        Discard
      </Button>
    </div>
  );
}
