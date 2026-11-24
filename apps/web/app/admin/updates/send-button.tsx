'use client';

import { sendDigestAction } from '@/app/admin/updates/actions';
import { Button } from '@/components/ui/button';
import { useRouter } from 'nextjs-toploader/app';
import { useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only. Sends today's update email now, instead of at the cron time. */
export function SendDigestButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  const send = () => {
    if (!window.confirm("Send today's update email to all subscribers now? The cron then sends nothing today.")) return;
    start(async () => {
      const result = await sendDigestAction();
      if (!result.ok) toast.error(result.error);
      else toast.success(result.message);
      router.refresh();
    });
  };
  return (
    <Button size="sm" disabled={pending} onClick={send}>
      {pending ? 'Sending…' : 'Send now'}
    </Button>
  );
}
