import type {
  Disclosure,
  Disclosures,
  EvalResult,
  ExternalTester,
  Finding,
  RiskDecision,
  TopicCoverage,
} from '@openaudit/spec';

// Combines a model's system cards into one view. Sources come newest first. For each item, the
// newest source that states it wins; `from` is the index of that source.

export type Sourced<T> = T & { from: number };

export type CardSourceData = {
  findings: Finding[];
  riskDecisions: RiskDecision[];
  topics: TopicCoverage[];
  testers: ExternalTester[];
  disclosures: Disclosures;
  results: EvalResult[];
};

export type MergedCard = {
  findings: Sourced<Finding>[];
  riskDecisions: Sourced<RiskDecision>[];
  topics: Sourced<TopicCoverage>[];
  testers: Sourced<ExternalTester>[];
  disclosures: { [K in keyof Disclosures]?: Sourced<Disclosure> };
  results: Sourced<EvalResult>[];
};

/** Two results are the same measurement when the eval, metric, settings and model match. */
export function resultKey(r: EvalResult) {
  const settings = Object.entries(r.settings ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const evalKey = r.evalId ?? r.rawEvalName?.trim().toLowerCase();
  return JSON.stringify([evalKey, r.metric.trim().toLowerCase(), settings, r.modelId ?? r.rawModelName]);
}

/** Keeps the items of the first source that has each key. One source can have a key twice. */
function newestWins<T>(items: Sourced<T>[], key: (x: T) => string) {
  const owner = new Map<string, number>();
  for (const x of items) if (!owner.has(key(x))) owner.set(key(x), x.from);
  return items.filter((x) => owner.get(key(x)) === x.from);
}

/** The words of a finding, without link targets, for a rough match. */
function words(text: string) {
  const plain = text.toLowerCase().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  return new Set((plain.match(/[a-z0-9.%]+/g) ?? []).filter((w) => w.length > 2));
}

/** Drops a finding when a newer source has one with most of the same words. */
function newFindings(findings: Sourced<Finding>[]) {
  const kept: { from: number; words: Set<string> }[] = [];
  return findings.filter((f) => {
    const w = words(f.text);
    const repeat = kept.some((k) => {
      if (k.from === f.from || !w.size || !k.words.size) return false;
      let shared = 0;
      for (const x of w) if (k.words.has(x)) shared++;
      return shared / Math.min(w.size, k.words.size) >= 0.6;
    });
    if (!repeat) kept.push({ from: f.from, words: w });
    return !repeat;
  });
}

export function mergeCards(sources: CardSourceData[]): MergedCard {
  const all = <T>(pick: (s: CardSourceData) => T[]): Sourced<T>[] =>
    sources.flatMap((s, from) => pick(s).map((x) => ({ ...x, from })));

  const topics = all((s) => s.topics);
  const disclosures: MergedCard['disclosures'] = {};
  sources.forEach((s, from) => {
    for (const [k, d] of Object.entries(s.disclosures) as [keyof Disclosures, Disclosure | undefined][])
      if (d?.status === 'stated' && !disclosures[k]) disclosures[k] = { ...d, from };
  });

  return {
    findings: newFindings(all((s) => s.findings)),
    // A risk area's verdicts all come from the newest source with a verdict in that area.
    riskDecisions: newestWins(
      all((s) => s.riskDecisions),
      (r) => r.domain,
    ),
    // A covered topic wins over one that is not covered.
    topics: newestWins([...topics.filter((t) => t.covered), ...topics.filter((t) => !t.covered)], (t) => t.topic),
    testers: newestWins(
      all((s) => s.testers),
      (t) => t.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
    ),
    disclosures,
    results: newestWins(
      all((s) => s.results),
      resultKey,
    ).sort((a, b) => (a.rawEvalName ?? '').localeCompare(b.rawEvalName ?? '') || a.metric.localeCompare(b.metric)),
  };
}
