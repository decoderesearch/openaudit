import SiteImage from '@/app/opengraph-image';
import { parseId } from '@/lib/ids';
import { ogFonts } from '@/lib/og/fonts';
import { C, OG_OPTIONS, OG_SIZE, OG_TYPE, OgEntity, OgResult } from '@/lib/og/parts';
import { headlineOf, scoredResult } from '@/lib/runs/main-score';
import { evalStandings } from '@/lib/server/eval-ranks';
import { getRun, runPath } from '@/lib/server/runs';
import { ImageResponse } from 'next/og';

export const alt = 'An evaluation run on OpenAudit: the eval, the model, and its headline score';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

/** The image of a run, and of its attempts and samples. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const uuid = parseId((await params).id);
  const [found, fonts] = await Promise.all([uuid ? getRun(uuid) : null, ogFonts()]);
  if (!found) return SiteImage();
  const { run, eval: e, version, model, results } = found;
  const { headline, headDef } = headlineOf(version);
  const head = results.find((r) => r.metric === headline);
  const standing = (await evalStandings().catch(() => null))?.[e.id]?.places[model.id];
  const place = standing?.href === runPath(run) ? standing : undefined;
  return new ImageResponse(
    <OgEntity
      eyebrow="Evaluation Run"
      title={e.displayName}
      path={runPath(run)}
      lines={[
        <div key="model" style={{ display: 'flex', gap: 10 }}>
          <span>on</span>
          <span style={{ fontWeight: 700, color: C.text }}>{model.displayName}</span>
        </div>,
      ]}
      art={
        head ? (
          <OgResult
            result={scoredResult(version, head)}
            label={headDef?.displayName || head.metric}
            place={place}
            width={300}
          />
        ) : undefined
      }
      note={e.description || undefined}
      longNote
      stats={[]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
