import SiteImage from '@/app/opengraph-image';
import { suitePath } from '@/lib/methods';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgBoard, OgEntity, OgMedals } from '@/lib/og/parts';
import { suiteOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'An evaluation suite on OpenAudit: its evaluations, and the variants with the most medals';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

export default async function Image({ params }: { params: Promise<{ suite: string }> }) {
  const [og, fonts] = await Promise.all([suiteOg((await params).suite), ogFonts()]);
  if (!og) return SiteImage();
  const { suite } = og;
  const byline = [og.creator, og.date].filter(Boolean).join(' · ');
  return new ImageResponse(
    <OgEntity
      eyebrow="Evaluation Suite"
      title={suite.displayName}
      path={suitePath(suite.slug)}
      lines={byline ? [byline] : []}
      art={
        og.top.length ? (
          <OgBoard
            width={510}
            groups={[
              {
                rows: og.top.slice(0, 3).map((v) => ({
                  name: v.label,
                  sub: v.method,
                  value: <OgMedals places={v.medals.map((m) => m.place)} />,
                })),
              },
            ]}
          />
        ) : undefined
      }
      note={suite.summary || undefined}
      stats={[
        { value: og.evals, label: 'Evaluations', tone: 'sky' },
        { value: og.methods, label: 'Methods', tone: 'slate' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
