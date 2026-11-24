import SiteImage from '@/app/opengraph-image';
import { COMMITMENTS_PATH } from '@/lib/commitments';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgBoard, OgEntity, OgPill } from '@/lib/og/parts';
import { commitmentsOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'Safety commitments on OpenAudit: the organizations with the most points';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-dynamic';

export default async function Image() {
  const [og, fonts] = await Promise.all([commitmentsOg().catch(() => null), ogFonts()]);
  if (!og?.orgs.length) return SiteImage();
  return new ImageResponse(
    <OgEntity
      eyebrow="Organizations"
      title="Safety Commitments"
      path={COMMITMENTS_PATH}
      lines={['Which AI organizations have made which safety commitments, and how far.']}
      art={
        <OgBoard
          width={400}
          groups={[
            {
              rows: og.orgs.slice(0, 6).map((o) => ({
                name: o.name,
                value: <OgPill score={o.score} width={120} height={34} />,
              })),
            },
          ]}
        />
      }
      stats={[
        { value: og.orgs.length, label: 'Organizations', tone: 'sky' },
        { value: og.commitments, label: 'Commitments', tone: 'slate' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
