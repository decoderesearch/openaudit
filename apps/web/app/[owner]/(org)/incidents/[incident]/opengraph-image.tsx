import SiteImage from '@/app/opengraph-image';
import { prisma } from '@/lib/db';
import { ogFonts } from '@/lib/og/fonts';
import { clip } from '@/lib/og/meta';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgEntity } from '@/lib/og/parts';
import { formatDate, PRIMARY_CATEGORY_LABELS } from '@/lib/org-research';
import { findOrganization } from '@/lib/server/catalog';
import { getIncident } from '@/lib/server/org-research';
import { ImageResponse } from 'next/og';

export const alt = 'A safety incident on OpenAudit: its organization, title, category and date';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** No summary text: only the facts that the incident's page shows at its top. */
export default async function Image({ params }: { params: Promise<{ owner: string; incident: string }> }) {
  const { owner, incident } = await params;
  const [named, fonts] = await Promise.all([findOrganization(owner), ogFonts()]);
  const found = named && (await getIncident(named.org.id, decodeURIComponent(incident)));
  if (!named || !found) return SiteImage();
  const { org } = named;
  const i = found.incident;
  const ids = i.modelIds ?? [];
  const models = ids.length
    ? await prisma.model.findMany({
        where: { id: { in: ids }, hidden: false, organization: { hidden: false } },
        select: { id: true, displayName: true },
      })
    : [];
  models.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  const start = formatDate(i.date, i.datePrecision);
  const end = formatDate(i.endDate);
  const facts = [end ? `${start} – ${end}` : start, models[0]?.displayName].filter(Boolean);
  return new ImageResponse(
    <OgEntity
      eyebrow={`Incident · ${org.displayName}`}
      title={clip(i.title, 110)}
      lines={[
        <span
          key="kind"
          style={{
            marginTop: 8,
            fontWeight: 700,
            color: '#d97706',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {PRIMARY_CATEGORY_LABELS[i.primaryCategory]}
        </span>,
        facts.join(' · '),
      ]}
      stats={[]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
