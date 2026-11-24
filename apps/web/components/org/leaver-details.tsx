import { Photo } from '@/components/org/departure-photo';
import { DEPARTURE_LABELS, formatDate, hostOf, plainText } from '@/lib/org-research';
import type { OrgDeparture } from '@openaudit/spec';
import { ExternalLink } from 'lucide-react';

/** The outlet of a departure's quote, else the host of its URL. */
function quoteSource(who: OrgDeparture) {
  const url = who.quote?.url;
  if (!url) return null;
  return who.sources.find((s) => s.url === url)?.publisher ?? hostOf(url);
}

/** A departure's photo, name with its kind and date, role, quote (or reason) and website. No
 * website when the quote is on its site. `source`: the quote's source name as a link; else as text. */
export function LeaverDetails({ who, source = true }: { who: OrgDeparture; source?: boolean }) {
  const website = who.website && (!who.quote || hostOf(who.quote.url) !== hostOf(who.website)) ? who.website : null;
  return (
    <>
      <div className="flex items-center gap-x-2.5">
        <Photo photo={who.image} name={who.name} className="size-8 text-[10px]" />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-1.5 text-slate-500">
            <span className="font-semibold text-slate-900">{who.name}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {DEPARTURE_LABELS[who.kind]}
            </span>
            {who.departedDate && (
              <span className="tabular-nums">{formatDate(who.departedDate, who.datePrecision)}</span>
            )}
          </p>
          {who.title && <p>{who.title}</p>}
        </div>
      </div>
      {who.quote && (
        <blockquote className="border-l-2 border-slate-300 pl-2 text-slate-700 italic">
          <span className="line-clamp-6 text-[11px] leading-snug">&ldquo;{who.quote.text}&rdquo;</span>
          {source ? (
            <a
              href={who.quote.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-0.5 inline-flex items-center gap-x-0.5 text-[11px] text-sky-800 not-italic hover:underline"
            >
              {quoteSource(who)} <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="mt-0.5 block text-[11px] text-slate-500 not-italic">{quoteSource(who)}</span>
          )}
        </blockquote>
      )}
      {who.reason && !who.quote && <p className="line-clamp-5 text-slate-700">{plainText(who.reason)}</p>}
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-x-1 text-[11px] text-sky-800 hover:underline"
        >
          {hostOf(website)}
          <ExternalLink className="size-3" />
        </a>
      )}
    </>
  );
}
