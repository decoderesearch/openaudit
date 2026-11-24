import type { ScoreDef } from '@openaudit/spec';

/** The def of an attempt's score, by its key, its last part (`audit_judge/concerning`) or `attemptName`. */
export function attemptScoreDef(defs: ScoreDef[], name: string): ScoreDef | undefined {
  const last = name.split('/').pop()!;
  return (
    defs.find((d) => d.key === name || d.key === last) ??
    defs.find((d) => d.attemptName === name || d.attemptName === last)
  );
}

/** The attempt's score names to show (`audit_judge/x@judge` too). When the attempt has each score
 * that the eval declares, the others (for example a stderr, or a third outcome) do not show. When
 * one is missing, the names do not match the defs, so all show. */
export function shownScoreNames(defs: ScoreDef[], names: string[]): string[] {
  const base = (n: string) => n.split('@')[0]!;
  const complete = defs.length > 0 && defs.every((d) => names.some((n) => attemptScoreDef([d], base(n))));
  return complete ? names.filter((n) => attemptScoreDef(defs, base(n))) : names;
}

const ANSWER_CHARS = 40;

/** A score's answer when it is a short label ("B", "unsafe"). Some scorers keep the whole reply
 * there: then undefined. */
export function labelAnswer(answer: unknown): string | undefined {
  if (answer === undefined || answer === null) return undefined;
  const text = String(answer).trim();
  return text && text.length <= ANSWER_CHARS && !text.includes('\n') ? text : undefined;
}

type Scores = Record<string, { value?: unknown; answer?: unknown } | null | undefined>;

/** The share of scored samples that must have a value for a column of answers. */
const MOSTLY = 0.9;
/** The header of a column of score values, by scorer. */
const VALUE_HEADERS: Record<string, string> = {
  abstention_bench_scorer: 'Abstained',
  'accuracy_and_honesty/honesty': 'Honesty',
};

/** A score value that is a word ("Yes"), not a number or a letter grade (`C`, `I`, `P`, `N`). */
const wordValue = (value: unknown) =>
  typeof value === 'string' && !/^[CIPN]$/.test(value) ? labelAnswer(value) : undefined;

export type AnswerColumn = { header: string; of: (scores: Scores) => string | undefined };

const filled = (v: unknown) => v !== undefined && v !== null && String(v).trim() !== '';

/** The column of short answers for a run's samples, from each first score: its answer when that is
 * a label in most samples with an answer (a refusal has none), else its value when that is a word in
 * most. Null: neither, as when the scorer keeps the whole reply. */
export function answerColumn(attempts: { scores: Scores }[]): AnswerColumn | null {
  const firsts = attempts.map((a) => Object.entries(a.scores)[0]).filter((e) => e?.[1]);
  const most = (key: 'answer' | 'value', f: (v: unknown) => unknown) => {
    const given = firsts.filter(([, s]) => filled(s![key]));
    return given.length > 0 && given.filter(([, s]) => f(s![key])).length >= MOSTLY * given.length;
  };
  const first = (scores: Scores) => Object.values(scores)[0];
  if (most('answer', labelAnswer)) return { header: 'Answer', of: (s) => labelAnswer(first(s)?.answer) };
  if (most('value', wordValue))
    return { header: VALUE_HEADERS[firsts[0]![0]] ?? 'Grade', of: (s) => wordValue(first(s)?.value) };
  return null;
}

/** A score pick's `min` on the attempts' scale. */
export const pickMin = (p: { min: number; attemptScale?: number }) => p.min / (p.attemptScale ?? 1);

/** Each line of a rubric target with the judges' vote, from an explanation such as "Majority votes
 * are NNNNNNY" (FORTRESS). Null: no votes, or not one vote for each line. */
export function rubricVotes(target: string, explanation: string | undefined) {
  const votes = explanation?.match(/votes are ([YN]+)\b/)?.[1];
  const lines = target.split('\n').filter((l) => l.trim());
  return votes?.length === lines.length ? lines.map((line, i) => ({ line, yes: votes[i] === 'Y' })) : null;
}

/** An attempt's value on its def's scale. A value that is not a number does not change. */
export function onScale<T>(value: T, def: Pick<ScoreDef, 'attemptScale'> | undefined): T | number {
  return typeof value === 'number' && def?.attemptScale ? value * def.attemptScale : value;
}
