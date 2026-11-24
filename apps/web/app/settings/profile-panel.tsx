'use client';

import ProfileFields from '@/components/profile/profile-fields';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProfileInput } from '@/lib/profile';
import { useState } from 'react';
import { toast } from 'sonner';
import { updateProfile } from './actions';

export default function ProfilePanel({ initial, email }: { initial: ProfileInput; email: string }) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await updateProfile(value);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success('Profile saved.');
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <ProfileFields value={value} onChange={setValue} email={email} />
          <Button type="submit" disabled={busy} className="sm:self-end">
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
