import SiteImage from '@/app/opengraph-image';
import { ogFonts } from '@/lib/og/fonts';
import { clip } from '@/lib/og/meta';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgEntity, OgScoreBar } from '@/lib/og/parts';
import { organizationPath } from '@/lib/organizations';
import { organizationOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'An organization on OpenAudit: its safety commitments, OpenAudits and safety incidents';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ owner: string }> }) {
  const { owner } = await params;
  const [og, fonts] = await Promise.all([organizationOg(owner), ogFonts()]);
  if (!og) return SiteImage();
  const { organization: org, commitments } = og;
  return new ImageResponse(
    <OgEntity
      path={organizationPath(org)}
      eyebrow="Organization"
      title={org.displayName}
      lines={[]}
      art={commitments ? <OgScoreBar score={commitments} label="Safety Commitments" width={340} /> : undefined}
      note={og.latestIncident ? `Latest incident: ${clip(og.latestIncident.title, 90)}` : undefined}
      stats={[
        { value: og.openAudits, label: 'OpenAudits', tone: 'sky' },
        { value: og.incidentCount, label: 'Incidents', tone: 'amber' },
        { value: og.departures, label: 'Departures', tone: 'slate' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
