'use client';

import { setSubmissionAction } from '@/app/admin/submissions/actions';
import { Button } from '@/components/ui/button';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';
import { SUBMISSION_STATUSES } from '@/lib/report';
import { useRouter } from 'nextjs-toploader/app';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/** Admins only: the status and the note of one submission. */
export function SubmissionControl({ id, status, note }: { id: string; status: string; note: string }) {
  const [next, setNext] = useState(status);
  const [text, setText] = useState(note);
  const [pending, start] = useTransition();
  const router = useRouter();
  const changed = next !== status || text.trim() !== note.trim();
  const save = () =>
    start(async () => {
      const result = await setSubmissionAction(id, next, text);
      if (!result.ok) return void toast.error(result.error);
      toast.success('Saved.');
      router.refresh();
    });
  return (
    <div className="flex flex-col gap-2">
      <SelectNative
        aria-label="Status"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="h-8 text-xs sm:h-8 sm:text-xs"
      >
        {SUBMISSION_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </SelectNative>
      <Textarea
        aria-label="Note"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Note for admins"
        className="min-h-14 text-xs md:text-xs"
      />
      <Button size="sm" className="h-7 self-end text-xs" disabled={!changed || pending} onClick={save}>
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}
