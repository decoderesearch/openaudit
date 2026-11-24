import SiteImage from '@/app/opengraph-image';
import { ogFonts } from '@/lib/og/fonts';
import { OG_OPTIONS, OG_SIZE, OG_TYPE, OgBoard, OgEntity, OgMiniMeter, OgWarning, type BoardRow } from '@/lib/og/parts';
import { modelsOg } from '@/lib/server/og';
import { ImageResponse } from 'next/og';

export const alt = 'Models on OpenAudit: the highest and lowest Deploymeter scores';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
export const dynamic = 'force-dynamic';

/** The warning shows when the evals of any model in the panel are too old for it. */
export default async function Image() {
  const [og, fonts] = await Promise.all([modelsOg().catch(() => null), ogFonts()]);
  if (!og?.highest.length) return SiteImage();
  const row = (m: (typeof og.highest)[number]): BoardRow => ({
    name: m.name,
    value: <OgMiniMeter score={m.meter} judges={m.judges} />,
  });
  return new ImageResponse(
    <OgEntity
      eyebrow="Models"
      title="AI Models"
      path="/models"
      lines={[
        'Deploymeter scores, flagged chats, and the model evaluations that we run.',
        ...(og.tooOld ? [<OgWarning key="old" text="Inaccurate Results Due to Outdated Evaluations" />] : []),
      ]}
      art={
        <OgBoard
          width={500}
          groups={[
            { heading: 'Highest', rows: og.highest.map(row) },
            ...(og.lowest.length ? [{ heading: 'Lowest', rows: og.lowest.map(row) }] : []),
          ]}
        />
      }
      stats={[
        { value: og.models, label: 'Models', tone: 'sky' },
        { value: og.evals, label: 'Model Evaluations', tone: 'slate' },
        { value: og.scored, label: 'Deploymeter Scores', tone: 'sky' },
      ]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
