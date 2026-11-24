'use client';

import { saveUpdatesAction } from '@/app/updates/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ListCheckboxes } from '@/components/updates/list-checkboxes';
import type { UpdateList } from '@/lib/updates';
import { useState } from 'react';
import { toast } from 'sonner';

/** The email update lists of the signed-in user. `initial` null: we could not read them. */
export default function UpdatesPanel({ email, initial }: { email: string; initial: UpdateList[] | null }) {
  const [lists, setLists] = useState(initial ?? []);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await saveUpdatesAction(lists);
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(lists.length ? 'Email updates saved.' : 'Email updates stopped.');
  }

  return (
    <Card id="email-updates" className="scroll-mt-20">
      <CardHeader>
        <CardTitle>Email Updates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-y-4">
        <p className="text-sm text-slate-600">
          At most one email per week to <span className="font-medium text-slate-800">{email}</span>, only when a list
          you pick has something new.
        </p>
        {initial === null ? (
          <p className="text-sm text-red-600">We could not load your email updates. Try again later.</p>
        ) : (
          <form
            className="flex flex-col gap-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <ListCheckboxes value={lists} onChange={setLists} idPrefix="settings-updates" />
            <Button type="submit" disabled={busy} className="sm:self-end">
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
