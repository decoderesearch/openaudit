'use client';

import { setRoleAction } from '@/app/admin/users/actions';
import { SegmentedControl } from '@/components/ui/segmented-control';
import type { SiteRole } from '@/lib/roles';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

const OPTIONS = [
  { value: 'user', label: 'None' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
] as const satisfies readonly { value: SiteRole; label: string }[];

const NAME: Record<SiteRole, string> = { user: 'no role', moderator: 'moderator', admin: 'admin' };

/** Admins only. Asks first, then sets the user's role. `self`: the viewer's own row, which is locked. */
export function UserRoleControl({
  userId,
  email,
  role: initial,
  self,
}: {
  userId: string;
  email: string;
  role: SiteRole;
  self: boolean;
}) {
  const [role, setRole] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <SegmentedControl
      label={`Role of ${email}`}
      value={role}
      options={OPTIONS}
      disabled={self || pending}
      onValueChange={(next) => {
        if (!window.confirm(`Change ${email} from ${NAME[role]} to ${NAME[next]}?`)) return;
        const before = role;
        setRole(next);
        start(async () => {
          const result = await setRoleAction(userId, next);
          if (result.ok) toast.success(`${email} is now ${NAME[next]}.`);
          else {
            setRole(before);
            toast.error(result.error);
          }
        });
      }}
    />
  );
}
