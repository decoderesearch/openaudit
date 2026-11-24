import { safeShare, type Score } from '@/components/catalog/score';
import { formatPoints, type Points } from '@/lib/commitments';
import { verdictOf, votesOf, type MeterJudge, type Vote } from '@/lib/deploymeter';
import { NEXT_PUBLIC_URL, SITE_NAME } from '@/lib/env';
import { placeBand, type Leader, type Place } from '@/lib/leaders';
import { ordinal } from '@/lib/methods';
import { clip } from '@/lib/og/meta';
import type { ReactNode } from 'react';

// Shared parts of the `next/og` share images. Satori takes inline styles only, and each `div` with
// more than one child needs `display: flex`.

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = 'image/png';
/** `ImageResponse` options. Its default cache is one year (immutable); the numbers change daily. */
export const OG_OPTIONS = { ...OG_SIZE, headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' } };

export const C = {
  ink: '#0f172a',
  text: '#334155',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  page: '#f8fafc',
  brand: '#00598A',
};

/** Slate-100: the empty part of a bar. */
const CORE = '#f1f5f9';

/** Slate-50 with a sky tint at the top right. */
export const OG_BACKGROUND = `radial-gradient(circle at 92% 18%, #e0f2fe 0%, rgba(224,242,254,0) 42%), ${C.page}`;

const TONES = {
  amber: { bg: '#fffbeb', border: '#fef3c7', fg: '#b45309' },
  sky: { bg: '#f0f9ff', border: '#e0f2fe', fg: '#0369a1' },
  slate: { bg: '#f8fafc', border: '#e2e8f0', fg: '#475569' },
  emerald: { bg: '#ecfdf5', border: '#d1fae5', fg: '#047857' },
  rose: { bg: '#fff1f2', border: '#ffe4e6', fg: '#be123c' },
};
export type Tone = keyof typeof TONES;

const host = new URL(NEXT_PUBLIC_URL).host;

/** The OpenAudit chip mark (`app/icon.svg`). */
export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="45 45 422 422">
      <path
        fill="none"
        stroke={C.brand}
        strokeWidth="26"
        strokeLinecap="round"
        d="M188 96V58M256 96V58M324 96V58M188 416v38M256 416v38M324 416v38M96 188H58M96 256H58M96 324H58M416 188h38M416 256h38M416 324h38"
      />
      <path
        fill="#FFFFFF"
        d="M150 136H362A14 14 0 0 1 376 150V362A14 14 0 0 1 362 376H150A14 14 0 0 1 136 362V150A14 14 0 0 1 150 136Z"
      />
      <path
        fill={C.brand}
        fillRule="evenodd"
        d="M126 96H386A30 30 0 0 1 416 126V386A30 30 0 0 1 386 416H126A30 30 0 0 1 96 386V126A30 30 0 0 1 126 96ZM150 136H362A14 14 0 0 1 376 150V362A14 14 0 0 1 362 376H150A14 14 0 0 1 136 362V150A14 14 0 0 1 150 136Z"
      />
      <path
        fill="none"
        stroke={C.brand}
        strokeWidth="31"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M332 212 228 316l-48-48"
      />
    </svg>
  );
}

/** The mark and the name. */
export function Brand({ size }: { size: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.28 }}>
      <Mark size={size} />
      <div style={{ fontSize: size * 0.72, fontWeight: 700, color: C.brand, letterSpacing: '-0.02em' }}>
        {SITE_NAME}
      </div>
    </div>
  );
}

export type Stat = { value: number; label: string; tone: Tone };

function StatTile({ value, label, tone }: Stat) {
  const t = TONES[value > 0 ? tone : 'slate'];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '16px 22px',
        borderRadius: 18,
        background: t.bg,
        border: `2px solid ${t.border}`,
      }}
    >
      <div style={{ fontSize: 50, fontWeight: 700, color: value > 0 ? t.fg : C.faint, lineHeight: 1.1 }}>
        {value.toLocaleString('en-US')}
      </div>
      <div style={{ fontSize: 20, fontWeight: 600, color: value > 0 ? t.fg : C.muted }}>{label}</div>
    </div>
  );
}

const titleSize = (s: string) => (s.length > 34 ? 50 : s.length > 24 ? 60 : 72);

/**
 * A page's share image: the brand and page URL (if `path`) at the top; the eyebrow, title
 * and detail lines at the left, `art` at the right; `note` and the stat tiles at the bottom. A text
 * line shows at most 4 lines, and `note` 2 (`longNote`: 4, larger and lighter); then "…".
 */
export function OgEntity({
  path,
  eyebrow,
  title,
  lines,
  note,
  stats,
  art,
  longNote,
}: {
  path?: string;
  eyebrow: string;
  title: string;
  lines: ReactNode[];
  note?: string;
  stats: Stat[];
  art?: ReactNode;
  longNote?: boolean;
}) {
  return (
    <div
      style={{
        ...OG_SIZE,
        display: 'flex',
        flexDirection: 'column',
        padding: '44px 60px 48px',
        background: OG_BACKGROUND,
        fontFamily: 'Inter',
        color: C.ink,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand size={44} />
        {path && <div style={{ fontSize: 22, fontWeight: 600, color: C.faint }}>{clip(`${host}${path}`, 60)}</div>}
      </div>
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 1,
            minWidth: 0,
            maxWidth: art ? 760 : 1080,
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: C.faint,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </div>
          <div style={{ fontSize: titleSize(title), fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {title}
          </div>
          {lines.map((line, i) =>
            typeof line === 'string' ? (
              <div key={i} style={{ display: 'block', lineClamp: 4, fontSize: 26, lineHeight: 1.4, color: C.muted }}>
                {line}
              </div>
            ) : (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 26, color: C.muted }}>
                {line}
              </div>
            ),
          )}
        </div>
        {art}
      </div>
      {note && (
        <div
          style={{
            display: 'block',
            lineClamp: longNote ? 4 : 2,
            fontSize: longNote ? 24 : 20,
            fontWeight: longNote ? 400 : 600,
            lineHeight: 1.45,
            color: C.muted,
            marginBottom: 12,
          }}
        >
          {note}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16 }}>
        {stats.map((s) => (
          <StatTile key={s.label} {...s} />
        ))}
      </div>
    </div>
  );
}

/** A rose panel with lucide's `TriangleAlert` in red, and `text`. */
export function OgWarning({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        alignSelf: 'flex-start',
        marginTop: 14,
        padding: '12px 22px 12px 18px',
        borderRadius: 14,
        background: '#fff1f2',
        border: '2px solid #fecdd3',
        fontSize: 24,
        fontWeight: 700,
        color: '#9f1239',
      }}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#dc2626"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      {text}
    </div>
  );
}

/** `BAND_TEXT` (`components/catalog/place-text.tsx`). */
const BAND_COLORS = { top: '#047857', middle: '#475569', bottom: '#b91c1c' } as const;

/** A run's headline result, as on its page: the metric, the value, and the safety bar (`SafetyBar`:
 * green for the part that is good for safety, red for the rest). Then its place, "3rd of 21
 * models", with the rank in its band's color. */
export function OgResult({
  result,
  label,
  place,
  width,
}: {
  result: Score;
  label: string;
  place?: Place;
  width: number;
}) {
  const share = safeShare(result);
  const value = Number.isInteger(result.value) ? result.value : result.value.toFixed(2);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width }}>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: C.faint,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          textAlign: 'center',
        }}
      >
        {clip(label, 28)}
      </div>
      <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.1, color: C.ink }}>
        {`${value}${result.unit === 'percent' ? '%' : ''}`}
      </div>
      {share !== undefined && (
        <div style={{ display: 'flex', marginTop: 8 }}>
          <SafetyBar share={share} width={width} height={14} />
        </div>
      )}
      {place && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14, fontSize: 24, fontWeight: 600, color: C.muted }}>
          <span style={{ fontWeight: 800, color: BAND_COLORS[placeBand(place)] }}>{ordinal(place.rank)}</span>
          {`of ${place.of} models`}
        </div>
      )}
    </div>
  );
}

/** `SafetyBar`: green for the share that is good for safety, red for the rest. */
function SafetyBar({ share, width, height }: { share: number; width: number; height: number }) {
  return (
    <div style={{ display: 'flex', width, height, borderRadius: height / 2, overflow: 'hidden' }}>
      <div style={{ width: `${share * 100}%`, height, background: '#059669' }} />
      <div style={{ flexGrow: 1, height, background: '#e11d48' }} />
    </div>
  );
}

/** A leader's safety bar (when its score has a direction), then its score. */
export function OgLeaderScore({ leader }: { leader: Leader }) {
  const share = leader.bar ? safeShare(leader.bar) : undefined;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {share !== undefined && <SafetyBar share={share} width={90} height={10} />}
      <div
        style={{ display: 'flex', justifyContent: 'flex-end', width: 84, fontSize: 22, fontWeight: 700, color: C.text }}
      >
        {leader.score}
      </div>
    </div>
  );
}

/** The colors of `VERDICTS` and `ABSTAIN` (`lib/deploymeter.ts`). */
const VOTE_COLORS: Record<Vote, string> = {
  reject: '#dc2626',
  limits: '#f59e0b',
  approve: '#059669',
  abstain: '#cbd5e1',
};

/** The Deploymeter, as on the model cards: the word, the score in its verdict color, and the
 * judges' votes bar (`VerdictBar`) below it. */
export function OgMeter({ score, judges, width }: { score: number; judges: MeterJudge[]; width: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width }}>
      <div
        style={{ fontSize: 22, fontWeight: 700, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        Deploymeter
      </div>
      <div
        style={{
          fontSize: 96,
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: 8,
          color: VOTE_COLORS[verdictOf(score)],
        }}
      >
        {`${score}%`}
      </div>
      <VotesBar judges={judges} width={width} height={14} />
    </div>
  );
}

/** The judges' votes, from reject to abstain. */
function VotesBar({ judges, width, height }: { judges: MeterJudge[]; width: number; height: number }) {
  const votes = votesOf(judges);
  const order: Vote[] = ['reject', 'limits', 'approve', 'abstain'];
  return (
    <div style={{ display: 'flex', width, height, borderRadius: height / 2, overflow: 'hidden', background: CORE }}>
      {order.map((v) =>
        votes[v] ? <div key={v} style={{ flexGrow: votes[v], height, background: VOTE_COLORS[v] }} /> : null,
      )}
    </div>
  );
}

/** A row's Deploymeter: the votes bar, then the score in its verdict color. */
export function OgMiniMeter({ score, judges }: { score: number; judges: MeterJudge[] }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <VotesBar judges={judges} width={100} height={10} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          width: 70,
          fontSize: 26,
          fontWeight: 800,
          color: VOTE_COLORS[verdictOf(score)],
        }}
      >
        {`${score}%`}
      </div>
    </div>
  );
}

/** The fill of `ScoreBar` (`components/commitments/level-pill.tsx`), by the share of points. */
const fillColor = (share: number) =>
  share >= 0.9 ? '#d1fae5' : share >= 0.7 ? '#fcd34d' : share >= 0.4 ? '#fdba74' : '#fca5a5';

/** The points fill a slate pill, with the points in it. */
export function OgPill({ score, width, height }: { score: Points; width: number; height: number }) {
  const share = score.points / (score.total || 1);
  return (
    <div
      style={{
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        background: C.line,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${100 * share}%`,
          background: fillColor(share),
        }}
      />
      <div style={{ fontSize: Math.round(height * 0.54), fontWeight: 700, color: C.text }}>
        {formatPoints(score.points)}
      </div>
    </div>
  );
}

/** The Safety Commitments bar, as on the home page: the points pill, and the label below. */
export function OgScoreBar({ score, label, width }: { score: Points; label: string; width: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width }}>
      <OgPill score={score} width={width} height={52} />
      <div
        style={{ fontSize: 18, fontWeight: 700, color: C.faint, letterSpacing: '0.08em', textTransform: 'uppercase' }}
      >
        {label}
      </div>
    </div>
  );
}

/** A row of an `OgBoard`. `sub`: a small line below the name. `medal`: a place, 1 to 3, left of the
 * name. */
export type BoardRow = { name: string; sub?: string; value: ReactNode; medal?: number };
/** `color`: the heading's color. */
export type BoardGroup = { heading?: string; color?: string; rows: BoardRow[] };

/** A short ranked list in a white panel, for `OgEntity`'s `art`: each group's heading, then its
 * rows, with the name at the left and `value` at the right. */
export function OgBoard({ groups, width }: { groups: BoardGroup[]; width: number }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        gap: 18,
        width,
        marginLeft: 40,
        padding: '22px 26px',
        borderRadius: 22,
        background: '#ffffff',
        border: `2px solid ${C.line}`,
      }}
    >
      {groups.map((g, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {g.heading && (
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: g.color ?? C.faint,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {g.heading}
            </div>
          )}
          {g.rows.map((r, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {r.medal && <Medal place={r.medal} />}
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minWidth: 0 }}>
                <div style={{ fontSize: 23, fontWeight: 700, color: C.ink }}>{clip(r.name, 24)}</div>
                {r.sub && <div style={{ fontSize: 16, fontWeight: 600, color: C.faint }}>{clip(r.sub, 34)}</div>}
              </div>
              <div style={{ display: 'flex', flexShrink: 0 }}>{r.value}</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The gold, silver and bronze medal circles, and their text colors. */
const MEDAL_COLORS = [
  ['#fcd34d', '#78350f'],
  ['#e2e8f0', '#334155'],
  ['#fdba74', '#7c2d12'],
];

/** A variant's medals: for each of the 1st, 2nd and 3rd places it has, a medal with the place, and
 * how many. Satori has no emoji, so these are circles. */
export function OgMedals({ places }: { places: number[] }) {
  return (
    <div style={{ display: 'flex', flexShrink: 0, gap: 8 }}>
      {[1, 2, 3].map((place) => {
        const n = places.filter((p) => p === place).length;
        return n ? (
          <div key={place} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Medal place={place} />
            <div style={{ fontSize: 18, fontWeight: 700, color: C.muted }}>{`×${n}`}</div>
          </div>
        ) : null;
      })}
    </div>
  );
}

/** One medal: a circle in its color, with the place (1 to 3) in it. */
function Medal({ place }: { place: number }) {
  const [bg, fg] = MEDAL_COLORS[place - 1];
  return (
    <div
      style={{
        display: 'flex',
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 13,
        background: bg,
        color: fg,
        fontSize: 15,
        fontWeight: 800,
      }}
    >
      {String(place)}
    </div>
  );
}
