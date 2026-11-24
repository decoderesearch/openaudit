import SiteImage from '@/app/opengraph-image';
import { monthYear } from '@/lib/card-heading';
import type { Leader } from '@/lib/leaders';
import { ogFonts } from '@/lib/og/fonts';
import {
  OG_OPTIONS,
  OG_SIZE,
  OG_TYPE,
  OgBoard,
  OgEntity,
  OgLeaderScore,
  type BoardGroup,
  type BoardRow,
} from '@/lib/og/parts';
import { evalOg } from '@/lib/server/og';
import { TOPIC_LABELS } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';
import { ImageResponse } from 'next/og';

export const alt = 'An evaluation on OpenAudit: what it tests, and its best and worst results';
export const size = OG_SIZE;
export const contentType = OG_TYPE;

const leaderRow = (l: Leader): BoardRow => ({ name: l.label, value: <OgLeaderScore leader={l} /> });

/** As the Evaluation of the Day card: a model eval's best and worst 3, or a method eval's best 3
 * with medals. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const [og, fonts] = await Promise.all([evalOg((await params).slug), ogFonts()]);
  if (!og) return SiteImage();
  const { eval: e, method, row: r, authors } = og;
  const topic = r?.topics[0] && (TOPIC_LABELS[r.topics[0] as Topic] ?? r.topics[0]);
  const byline = [r?.creator, monthYear(r?.date ?? null)].filter(Boolean).join(' · ');
  const summary = r?.summary ?? e.description;
  const groups: BoardGroup[] = !r
    ? []
    : method
      ? [
          {
            rows: (r.top ?? r.best).slice(0, 3).map((l, i) => ({
              ...leaderRow(l),
              sub: authors.get(l.href) ?? undefined,
              medal: i + 1,
            })),
          },
        ]
      : [
          { heading: `Best of ${r.count} models`, color: '#059669', rows: r.best.map(leaderRow) },
          { heading: `Worst of ${r.count} models`, color: '#e11d48', rows: r.worst.map(leaderRow) },
        ];
  const shown = groups.filter((g) => g.rows.length);
  return new ImageResponse(
    <OgEntity
      eyebrow={`${method ? 'Method' : 'Model'} Evaluation${topic ? ` · ${topic}` : ''}`}
      title={e.displayName}
      path={`/evaluations/${e.slug}`}
      lines={byline ? [byline] : []}
      art={shown.length ? <OgBoard width={520} groups={shown} /> : undefined}
      note={summary || undefined}
      stats={[]}
    />,
    { ...OG_OPTIONS, fonts },
  );
}
