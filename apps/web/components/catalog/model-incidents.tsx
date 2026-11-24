import { INCIDENTS_HASH } from '@/components/catalog/model-list';
import { InfoPopover } from '@/components/info-popover';
import { IncidentCategory } from '@/components/org/incident-category';
import { StoryLink } from '@/components/org/story-link';
import { formatDate } from '@/lib/org-research';
import type { FeedIncident } from '@/lib/server/org-feed';

/** The model page's incidents, in an amber panel. Two columns when the panel is wide. */
export function ModelIncidents({ incidents }: { incidents: FeedIncident[] }) {
  return (
    <div
      id={INCIDENTS_HASH}
      className="@container flex scroll-mt-20 flex-col gap-y-2 rounded-md bg-amber-50 px-4 py-3.5"
    >
      <div className="flex items-center gap-x-1">
        <h3 className="text-xs font-semibold tracking-wide text-amber-700 uppercase">Incidents</h3>
        <InfoPopover label="Incidents" iconClassName="size-3.5" contentClassName="text-xs">
          Significant AI safety and security events that involve this model, from public reporting. The label over each
          title says what went wrong. Open an incident to see what happened.
        </InfoPopover>
      </div>
      <ul className="grid gap-x-6 gap-y-2 @2xl:grid-cols-2">
        {incidents.map((i) => (
          <IncidentRow key={i.key} incident={i} />
        ))}
      </ul>
    </div>
  );
}

/** Title, then the start date on the same line. */
function IncidentRow({ incident: i }: { incident: FeedIncident }) {
  return (
    <li className="flex flex-col">
      <IncidentCategory category={i.category} className="text-amber-800/80" />
      <p className="min-w-0 text-xs/[18px]">
        <StoryLink href={i.href} className="text-slate-900 hover:underline">
          {i.title}
        </StoryLink>
        <span className="ml-1.5 text-[10px] whitespace-nowrap text-slate-600">{formatDate(i.started)}</span>
      </p>
    </li>
  );
}
