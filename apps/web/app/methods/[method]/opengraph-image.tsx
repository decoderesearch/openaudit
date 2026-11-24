import SiteImage from '@/app/opengraph-image';
import { METHOD_GROUPS, methodPath } from '@/lib/methods';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgBoard, OgEntity, OgMedals } from '@/lib/og/parts';
import { methodOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'A safety method on OpenAudit: its variants and their medals in its evaluations';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The image of a method, and of its variants. */
export default async function Image({ params }: { params: Promise<{ method: string }> }) {
  const [og, fonts] = await Promise.all([methodOg((await params).method), ogFonts()]);
  if (!og) return SiteImage();
  const { method, variants } = og;
  const ranked = variants.filter((v) => v.medals.length);
  return new ImageResponse(
    <OgEntity
      eyebrow={`Method · ${METHOD_GROUPS[method.group].title}`}
      title={method.displayName}
      path={methodPath(method.slug)}
      lines={method.summary ? [method.summary] : []}
      art={
        ranked.length ? (
          <OgBoard
            width={420}
            groups={[
              {
                rows: ranked.slice(0, 5).map((v) => ({
                  name: v.label,
                  value: <OgMedals places={v.medals.map((m) => m.place)} />,
                })),
              },
            ]}
          />
        ) : undefined
      }
      stats={[
        { value: variants.length, label: 'Variants', tone: 'sky' },
        { value: og.evals, label: 'Evaluations', tone: 'slate' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
