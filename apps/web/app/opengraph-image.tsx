import { SITE_TAGLINE } from '@/lib/env';
import { ogFonts } from '@/lib/og/fonts';
import { Brand, C, OG_BACKGROUND, OG_OPTIONS, OG_SIZE, OG_TYPE } from '@/lib/og/parts';
import { methodEvalRows, runnableModelEvalCount } from '@/lib/server/eval-list-rows';
import { homeCounts } from '@/lib/server/home-counts';
import { ImageResponse } from 'next/og';

export const alt = 'OpenAudit: its models, organizations, safety methods and their evaluations';
export const size = OG_SIZE;
export const contentType = OG_TYPE;
// Not made at build time: the counts change.
export const dynamic = 'force-dynamic';

const WIDTH = 1080;

/** The site's share image, and the default of each page with no image of its own: the six counts
 * of the home page's columns, each column's two counts one above the other. */
export default async function Image() {
  const [counts, modelEvals, methodEvals, fonts] = await Promise.all([
    homeCounts().catch(() => null),
    runnableModelEvalCount().catch(() => null),
    methodEvalRows()
      .then((rows) => rows.length)
      .catch(() => null),
    ogFonts(),
  ]);
  const columns: [number | null | undefined, string][][] = [
    [
      [counts?.models, 'Models'],
      [modelEvals, 'Model Evaluations'],
    ],
    [
      [counts?.organizations, 'Organizations'],
      [counts?.commitments, 'Safety Commitments'],
    ],
    [
      [counts?.methods, 'Safety Methods'],
      [methodEvals, 'Method Evaluations'],
    ],
  ];
  return new ImageResponse(
    <div
      style={{
        ...OG_SIZE,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '44px 60px 0',
        background: OG_BACKGROUND,
        fontFamily: 'Inter',
      }}
    >
      <Brand size={64} />
      <div style={{ marginTop: 18, fontSize: 26, fontWeight: 600, color: C.text }}>{SITE_TAGLINE}</div>
      <div style={{ display: 'flex', gap: 20, width: WIDTH, marginTop: 'auto' }}>
        {columns.map((column, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 20 }}>
            {column.map(([value, label]) => (
              <div
                key={label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '18px 28px',
                  borderRadius: 22,
                  background: 'white',
                  border: `2px solid ${C.line}`,
                }}
              >
                <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, color: C.brand }}>
                  {value == null ? '–' : value.toLocaleString('en-US')}
                </div>
                <div style={{ fontSize: 24, fontWeight: 600, color: C.text }}>{label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          width: WIDTH,
          marginTop: 'auto',
          marginBottom: 30,
          padding: '0 6px',
          fontSize: 15,
          fontWeight: 600,
          color: C.faint,
        }}
      >
        <div>DECODE RESEARCH</div>
        <div>OPENAUDIT.COM</div>
      </div>
    </div>,
    { ...OG_OPTIONS, fonts },
  );
}
