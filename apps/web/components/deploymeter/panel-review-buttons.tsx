'use client';

import { reviewPanelAction } from '@/app/deploymeter-actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'nextjs-toploader/app';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Publish shows the draft panel to all; Discard keeps the published one. */
export function PanelReviewButtons({ panelId, label }: { panelId: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = (publish: boolean) => {
    const text = publish
      ? `Publish ${label}? All visitors then see its score and reviews.`
      : `Discard ${label}? The public keeps the published panel, if there is one.`;
    if (!window.confirm(text)) return;
    start(async () => {
      const result = await reviewPanelAction(panelId, publish);
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
