import { accessRequestHref, HAZARD_TITLE, hazardNote } from '@/lib/runs/hazard';
import { cn } from '@/lib/utils';
import type { Hazard } from '@openaudit/spec';

/** In place of a transcript that the viewer cannot read: a rose panel with `HAZARD_TITLE`, the
 * summary (`reply_summary`), `hazardNote`, and for `restricted` a link that mails support for
 * access. `url`: the sample's full URL; `name`: the eval and the full sample id, for the subject. */
export function WithheldReply({
  level,
  summary,
  url,
  name,
  className,
}: {
  level: Hazard;
  summary: string | null;
  url: string;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-y-2 rounded-md bg-rose-50 px-4 py-3 text-xs text-slate-600', className)}>
      <p className="text-center font-semibold text-rose-800">{HAZARD_TITLE}</p>
      {summary && <p className="text-sm text-slate-800">{summary}</p>}
      <p>{hazardNote(!!summary)}</p>
      {level === 'restricted' && (
        <p>
          Request the conversation transcript{' '}
          <a href={accessRequestHref(url, name)} className="text-sky-800 underline hover:text-sky-900">
            here
          </a>
          .
        </p>
      )}
    </div>
  );
}
