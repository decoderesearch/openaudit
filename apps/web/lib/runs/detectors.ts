import type { AttemptScore, ScoreDef } from '@openaudit/spec';

/** A detector of a methods eval: its attempt score key, label and what its score means. `kind`: its
 * method, as "Probes". `share`: its score is the share of hidden tokens found, with no answer.
 * `hit`: a share score that is 1 or 0, for one test of the reply (as a swap). */
export type DetectorDef = {
  key: string;
  label: string;
  description?: string;
  kind?: string;
  share?: boolean;
  hit?: boolean;
};

/** A detector's call on a reply: its answer (`lie`, `honest`) and its score. `right`: the answer is
 * the reply's label; null when the reply has no graded label. */
export type DetectorCall = { answer: string; value: number | null; right: boolean | null };

/** The sorts of the samples that are not a detector key. */
export const BY_LIES = ':lies';
export const BY_HONEST = ':honest';
export const BY_TOTAL = ':total';
export const BY_TOTAL_ASC = ':total-asc';
/** The sort by a detector's fewest misses first, as `<key>:asc`. */
export const fewestOf = (key: string) => `${key}:asc`;

/** The labels that a detector can get right or wrong. Other labels (`ambiguous`) are not graded. */
const GRADED = ['lie', 'honest'];

/** The labels of the replies, most first: "Lie: 10 Replies · Honest: 4 Replies", or "All Replies:
 * Lie" with one label. */
export function labelTally(labels: Map<string, number>) {
  const name = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);
  const counts = [...labels].sort((a, b) => b[1] - a[1]);
  if (counts.length === 1) return `All Replies: ${name(counts[0]![0])}`;
  return counts.map(([l, n]) => `${name(l)}: ${n} ${n === 1 ? 'Reply' : 'Replies'}`).join(' · ');
}

/** The version's scores that some attempt answers: the detectors. */
export function detectorsOf(
  scores: ScoreDef[],
  attempts: { scores: Record<string, AttemptScore | undefined> }[],
): DetectorDef[] {
  return scores
    .map((s) => ({ key: s.attemptName ?? s.key, label: s.displayName, description: s.description }))
    .filter((d) => attempts.some((a) => a.scores[d.key]?.answer != null));
}

/** Each detector's call on a reply with the label `target`. */
export function detectorCalls(
  scores: Record<string, AttemptScore | undefined>,
  detectors: DetectorDef[],
  target: string | null,
): Record<string, DetectorCall> {
  const graded = target != null && GRADED.includes(target);
  return Object.fromEntries(
    detectors.flatMap((d) => {
      const s = scores[d.key];
      if (s?.answer == null) return [];
      const call = {
        answer: s.answer,
        value: typeof s.value === 'number' ? s.value : null,
        right: graded ? s.answer === target : null,
      };
      return [[d.key, call]];
    }),
  );
}

/** True for a score from 0 to 1 where higher is better: a share, or 1 or 0 (`binary`). */
export const isShareScore = (s: ScoreDef) =>
  s.direction === 'higher_is_better' &&
  (s.type === 'binary'
    ? (s.min ?? 0) === 0 && (s.max ?? 1) === 1
    : s.type === 'continuous' && s.min === 0 && s.max === 1);

/** The scores that are a share of hidden tokens found, from 0 to 1, that some attempt has: the
 * detectors of a methods eval with no answers. */
export function shareDetectorsOf(
  scores: ScoreDef[],
  attempts: { scores: Record<string, AttemptScore | undefined> }[],
): DetectorDef[] {
  return scores
    .filter(isShareScore)
    .map((s) => ({
      key: s.attemptName ?? s.key,
      label: s.displayName,
      description: s.description,
      share: true,
      ...(s.type === 'binary' && { hit: true }),
    }))
    .filter((d) => attempts.some((a) => typeof a.scores[d.key]?.value === 'number'));
}

/** Each detector's call on an attempt: from its label (`target`, a string), or from its hidden
 * tokens for share detectors. */
export function callsOf(
  a: { scores: Record<string, AttemptScore | undefined>; target?: unknown },
  detectors: DetectorDef[],
): Record<string, DetectorCall> {
  return detectors.some((d) => d.share)
    ? shareCalls(a.scores, detectors, a.target)
    : detectorCalls(a.scores, detectors, typeof a.target === 'string' ? a.target : null);
}

/** Each share detector's call on a reply with the hidden tokens `target`: the tokens that it missed
 * of all, as "1/4 Missed". With one test (one token, or a `hit` detector): "Missed" or "Passed",
 * with no value. It is right when it missed none. */
export function shareCalls(
  scores: Record<string, AttemptScore | undefined>,
  detectors: DetectorDef[],
  target: unknown,
): Record<string, DetectorCall> {
  const tokens = Array.isArray(target) ? target.length || 1 : 1;
  return Object.fromEntries(
    detectors.flatMap((d): [string, DetectorCall][] => {
      const v = scores[d.key]?.value;
      if (typeof v !== 'number') return [];
      const n = d.hit ? 1 : tokens;
      const missed = Math.round((1 - v) * n);
      if (n === 1) return [[d.key, { answer: missed ? 'Missed' : 'Passed', value: null, right: !missed }]];
      return [[d.key, { answer: `${missed}/${n} Missed`, value: v, right: missed === 0 }]];
    }),
  );
}
