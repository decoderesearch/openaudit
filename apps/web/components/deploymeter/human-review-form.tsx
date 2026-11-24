'use client';

import { deleteHumanReviewAction, saveHumanReviewAction } from '@/app/deploymeter-actions';
import { ScoreRing } from '@/components/deploymeter/score-ring';
import { Button } from '@/components/ui/button';
import { BANDS, MAX_REVIEW_CHARS, MIN_REVIEW_CHARS } from '@/lib/deploymeter';
import { useRouter } from 'nextjs-toploader/app';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

/** The viewer's review of a model: a score (0 to 100, steps of 5) and a short text. `mine`: the
 * viewer's saved review, to edit or delete. */
export function HumanReviewForm({
  modelId,
  modelName,
  mine,
}: {
  modelId: string;
  modelName: string;
  mine?: { score: number; text: string };
}) {
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(mine?.score ?? 50);
  const [text, setText] = useState(mine?.text ?? '');
  const [pending, start] = useTransition();
  const router = useRouter();
  const band = BANDS.find((b) => score >= b.from)!;

  if (!open)
    return (
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)}>
        {mine ? 'Edit Your Review' : 'Write a Review'}
      </Button>
    );

  const save = () =>
    start(async () => {
      const result = await saveHumanReviewAction(modelId, score, text);
      if (!result.ok) return void toast.error(result.error);
      toast.success('Review saved.');
      setOpen(false);
      router.refresh();
    });
  const remove = () => {
    if (!window.confirm('Delete your review?')) return;
    start(async () => {
      const result = await deleteHumanReviewAction(modelId);
      if (!result.ok) return void toast.error(result.error);
      toast.success('Review deleted.');
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <form
      className="flex w-full flex-col gap-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="flex flex-col gap-y-1">
        <span className="font-medium text-slate-700">
          How much do you trust {modelName} for wide public deployment, from a safety view?
        </span>
        <span className="flex items-center gap-x-3">
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="flex-1 accent-sky-700"
            aria-label="Score"
          />
          <ScoreRing score={score} size="sm" />
        </span>
        <span className="text-slate-500">{band.text}</span>
      </label>
      <label className="flex flex-col gap-y-1">
        <span className="font-medium text-slate-700">Why?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={MAX_REVIEW_CHARS}
          placeholder="The evidence that matters most to you, for and against."
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800"
        />
        <span className="text-slate-400">
          {text.trim().length < MIN_REVIEW_CHARS
            ? `At least ${MIN_REVIEW_CHARS} characters.`
            : `${text.length} of ${MAX_REVIEW_CHARS}`}
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={pending}>
          Save Review
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        {mine && (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-red-700" onClick={remove}>
            Delete
          </Button>
        )}
      </div>
    </form>
  );
}
