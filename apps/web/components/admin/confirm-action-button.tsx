'use client';

import { Button } from '@/components/ui/button';
import { useRouter } from 'nextjs-toploader/app';
import { useTransition } from 'react';
import { toast } from 'sonner';

type Result = { ok: true } | { ok: false; error: string };

/** Admins only. A small button that asks `confirm`, then calls the server `action`. */
export function ConfirmActionButton({
  action,
  label,
  confirm,
  done,
  variant = 'outline',
}: {
  action: () => Promise<Result>;
  label: string;
  confirm: string;
  done: string;
  variant?: 'outline' | 'default';
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const act = () => {
    if (!window.confirm(confirm)) return;
    start(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(done);
      router.refresh();
    });
  };
  return (
    <Button variant={variant} size="sm" className="h-6 px-2 text-[11px]" disabled={pending} onClick={act}>
      {label}
    </Button>
  );
}
