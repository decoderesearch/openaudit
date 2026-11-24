import { IncidentList } from '@/components/org/incident-list';
import { incidentsPath } from '@/lib/org-research';
import { findOrganization, isHiddenOrganization } from '@/lib/server/catalog';
import { listIncidentCards } from '@/lib/server/org-research';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

// An organization's safety incidents: `/<org>/incidents`, newest first.

type Props = { params: Promise<{ owner: string }> };

async function load(params: Props['params']) {
  const named = await findOrganization((await params).owner);
  if (!named) return null;
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) return null;
  return { ...named, incidents: await listIncidentCards(named.org.id) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Incidents' };
  return {
    title: `Safety Incidents at ${found.org.displayName}`,
    alternates: { canonical: incidentsPath(found.org) },
  };
}

export default async function IncidentsPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  if (found.redirect) permanentRedirect(incidentsPath(found.org));
  return <IncidentList org={found.org} incidents={found.incidents} />;
}
