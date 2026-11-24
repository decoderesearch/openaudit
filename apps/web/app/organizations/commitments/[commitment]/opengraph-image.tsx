import SiteImage from '@/app/opengraph-image';
import { CATEGORY_LABELS, commitmentPath } from '@/lib/commitments';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgBoard, OgEntity, OgPill } from '@/lib/og/parts';
import { plainText } from '@/lib/org-research';
import { commitmentOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'A safety commitment on OpenAudit: how many organizations meet it, and how far';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ commitment: string }> }) {
  const slug = decodeURIComponent((await params).commitment);
  const [og, fonts] = await Promise.all([commitmentOg(slug), ogFonts()]);
  if (!og) return SiteImage();
  const { commitment: c, orgs, groups } = og;
  return new ImageResponse(
    <OgEntity
      eyebrow={`Safety Commitment · ${CATEGORY_LABELS[c.category]}`}
      title={c.name}
      path={commitmentPath(c.slug)}
      lines={[plainText(c.summary)]}
      art={
        orgs.length ? (
          <OgBoard
            width={400}
            groups={[
              {
                rows: orgs.slice(0, 5).map((o) => ({
                  name: o.name,
                  value: <OgPill score={o.score} width={120} height={34} />,
                })),
              },
            ]}
          />
        ) : undefined
      }
      stats={[
        { value: groups.full, label: 'Full', tone: 'emerald' },
        { value: groups.partial, label: 'Partial', tone: 'amber' },
        { value: groups.none, label: 'None', tone: 'rose' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
