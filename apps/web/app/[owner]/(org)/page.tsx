import { OrgOverview } from '@/components/org/org-overview';
import { criteriaScore } from '@/lib/commitments';
import { clip, countList, shareMetadata } from '@/lib/og/meta';
import { plainText } from '@/lib/org-research';
import { organizationPath } from '@/lib/organizations';
import { findOrganization, isHiddenOrganization, modelPath } from '@/lib/server/catalog';
import { listOrgCommitments } from '@/lib/server/commitments';
import { organizationOg } from '@/lib/server/og';
import { listDepartures, listIncidentCards } from '@/lib/server/org-research';
import { auditedModels, unauditedModels } from '@/lib/server/snippet-feed';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

type Props = { params: Promise<{ owner: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const og = await organizationOg((await params).owner);
  if (!og) return { title: 'Organization' };
  const org = og.organization;
  const counts = countList([
    [og.models, 'model', 'models'],
    [og.openAudits, 'OpenAudit', 'OpenAudits'],
    [og.flagged, 'flagged chat', 'flagged chats'],
    [og.incidentCount, 'safety incident', 'safety incidents'],
  ]);
  const description = clip(
    `${org.displayName} on OpenAudit: ${counts}.${org.summary ? ` ${plainText(org.summary)}` : ''}`,
    300,
  );
  const url = organizationPath(org);
  return {
    title: org.displayName,
    description,
    alternates: { canonical: url },
    ...shareMetadata(org.displayName, description, url, `/${org.slug}/opengraph-image`),
  };
}

/** The organization's overview: its commitments, models, departures and incidents. */
export default async function OrganizationPage({ params }: Props) {
  const named = await findOrganization((await params).owner);
  if (!named) notFound();
  if (named.redirect) permanentRedirect(organizationPath(named.org));
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) notFound();
  const { id, slug } = named.org;
  const [rows, audited, unaudited, departures, incidents] = await Promise.all([
    listOrgCommitments(id),
    auditedModels(slug),
    unauditedModels(slug),
    listDepartures(id),
    listIncidentCards(id),
  ]);
  const commitments = rows.map(({ commitment, cell }) => ({
    slug: commitment.slug,
    name: commitment.name,
    category: commitment.category,
    state: cell ? { level: cell.state.level } : null,
    score:
      cell &&
      criteriaScore(
        cell.state,
        commitment.criteria.map((x) => x.key),
      ),
    latest: cell?.latest ?? null,
  }));
  const models = [
    ...audited.map(({ label, href, meter, date }) => ({ label, href, meter, date })),
    ...unaudited.map((m) => ({ label: m.displayName, href: modelPath(m), meter: null, date: null })),
  ];
  return <OrgOverview org={named.org} data={{ commitments, models, departures, incidents }} />;
}
