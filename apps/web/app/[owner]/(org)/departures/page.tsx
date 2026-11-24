import { INSET_TITLE } from '@/components/box-title';
import { Photo, PhotoCredit } from '@/components/org/departure-photo';
import { DEPARTURE_LABELS, departureAnchor, departuresPath, formatDate, hostOf, plainText } from '@/lib/org-research';
import { findOrganization, isHiddenOrganization } from '@/lib/server/catalog';
import { listDepartures } from '@/lib/server/org-research';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { cn } from '@/lib/utils';
import type { OrgDeparture } from '@openaudit/spec';
import { ExternalLink, UserX } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

// The people who left an organization: `/<org>/departures`.

type Props = { params: Promise<{ owner: string }> };

async function load(params: Props['params']) {
  const named = await findOrganization((await params).owner);
  if (!named) return null;
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) return null;
  return { ...named, departures: await listDepartures(named.org.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Departures' };
  const title = `Departures from ${found.org.displayName}`;
  return { title, alternates: { canonical: departuresPath(found.org) } };
}

export default async function DeparturesPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  if (found.redirect) permanentRedirect(departuresPath(found.org));
  const { departures } = found;
  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex h-10 items-center bg-slate-50 px-4 sm:px-5">
        <h1 className={cn(INSET_TITLE, 'flex items-center gap-x-1.5 text-xs')}>
          <UserX aria-hidden className="size-3.5 text-rose-700" strokeWidth={2.5} />
          Departures
        </h1>
      </div>
      {departures.length ? (
        <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
          {departures.map((d) => (
            <DepartureCard key={d.name} who={d} />
          ))}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-slate-500">No departures.</p>
      )}
    </section>
  );
}

/** A person: the photo, name, role, kind and date, then the quote (else the reason) and a link to
 * the quote's source, else to the first source. */
function DepartureCard({ who }: { who: OrgDeparture }) {
  const link = who.quote?.url ?? who.sources[0]?.url;
  const outlet = link && (who.sources.find((s) => s.url === link)?.publisher ?? hostOf(link));
  return (
    <li
      id={departureAnchor(who.name)}
      className="flex scroll-mt-28 flex-col items-center gap-y-2 rounded-lg border border-slate-200 p-4 text-center lg:scroll-mt-3"
    >
      <Photo photo={who.image} name={who.name} large className="size-20 text-lg" />
      <div className="flex flex-col gap-y-0.5">
        <p className="text-sm font-semibold text-slate-900">{who.name}</p>
        {who.title && <p className="text-xs text-slate-500">{who.title}</p>}
        <p className="text-[11px] font-semibold tracking-wide text-rose-700 uppercase">
          {DEPARTURE_LABELS[who.kind]}
          {who.departedDate && (
            <span className="font-medium text-slate-400 tabular-nums">
              {' · '}
              {formatDate(who.departedDate, who.datePrecision)}
            </span>
          )}
        </p>
      </div>
      {who.quote ? (
        <blockquote className="text-left text-xs/relaxed text-slate-700 italic">
          &ldquo;{who.quote.text}&rdquo;
        </blockquote>
      ) : (
        who.reason && <p className="text-left text-xs/relaxed text-slate-600">{plainText(who.reason)}</p>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-auto inline-flex items-center gap-x-1 text-xs font-medium text-sky-800 hover:underline"
        >
          {outlet}
          <ExternalLink aria-hidden className="size-3" />
        </a>
      )}
      {who.image && <PhotoCredit photo={who.image} />}
    </li>
  );
}
