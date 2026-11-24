import { IncidentView, loadIncident } from '@/components/org/incident-view';
import { incidentPath, plainText } from '@/lib/org-research';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

// One safety incident: `/<org>/incidents/<slug>`. An alias or another letter case of the
// organization redirects to its slug.

type Props = { params: Promise<{ owner: string; incident: string }> };

async function load(params: Props['params']) {
  const { owner, incident } = await params;
  return loadIncident(owner, decodeURIComponent(incident));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await load(params);
  if (!found) return { title: 'Incident' };
  const { incident: i, org } = found;
  const description = plainText(i.summary);
  const url = incidentPath(org, i.slug);
  // No `images`: they would replace the folder's `opengraph-image`, whose URL in this route group
  // has a hash suffix.
  return {
    title: i.title,
    description,
    alternates: { canonical: url },
    openGraph: { title: i.title, description, url, type: 'article' },
    twitter: { card: 'summary_large_image', title: i.title, description },
  };
}

export default async function IncidentPage({ params }: Props) {
  const found = await load(params);
  if (!found) notFound();
  if (found.redirect) permanentRedirect(incidentPath(found.org, found.incident.slug));
  return <IncidentView found={found} />;
}
