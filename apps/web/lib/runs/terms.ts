import type { DisplayRule, EvalAttempt, EvalVersion, SampleTerms } from '@openaudit/spec';

// Dataset terms on showing samples (`SampleTerms` in the spec). The runner sets an attempt's
// `display` when a subset rule matches; else the version's rule applies.

const RANK: Record<DisplayRule, number> = { open: 0, sign_in: 1, scores_only: 2 };

export function versionRule(version: Pick<EvalVersion, 'sampleTerms'>): DisplayRule {
  return version.sampleTerms?.display ?? 'open';
}

export function attemptRule(version: Pick<EvalVersion, 'sampleTerms'>, attempt: Pick<EvalAttempt, 'display'>) {
  return attempt.display ?? versionRule(version);
}

export function strictest(rules: DisplayRule[]): DisplayRule {
  return rules.reduce<DisplayRule>((a, b) => (RANK[b] > RANK[a] ? b : a), 'open');
}

/** True for a non-commercial license (`cc-by-nc-4.0`, "CC BY-NC-SA"). */
export function isNonCommercial(license: string | undefined): boolean {
  return !!license && /(^|[-\s])nc([-\s]|$)/i.test(license);
}

/** The text a user accepts: changes to it need a new acceptance. */
export function termsText(terms: SampleTerms): string {
  const parts = [terms.quote, ...(terms.subsets ?? []).map((s) => s.quote), terms.note];
  return [...new Set(parts.filter(Boolean))].join('\n\n');
}

/** Removes all sample text from an attempt. Scores, pass or fail and token counts stay. */
export function redactAttempt(a: EvalAttempt): EvalAttempt {
  const { input: _i, output: _o, target: _t, choices: _c, body: _b, notScored: _n, ...rest } = a;
  const scores = Object.fromEntries(Object.entries(a.scores).map(([k, s]) => [k, s && { value: s.value }]));
  return { ...rest, scores };
}
