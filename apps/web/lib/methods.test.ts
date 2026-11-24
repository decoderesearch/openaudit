import type { MethodCompare, MethodMatch } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import {
  baseOf,
  bytesText,
  coreCount,
  download,
  formatParam,
  formatValue,
  groupValue,
  inGroup,
  interpolateAt,
  jobsFor,
  jobsIn,
  matchedBases,
  median,
  methodPathOf,
  metricMedians,
  newestFirst,
  oneEach,
  oneOf,
  paramText,
  paramValuesIn,
  scorecard,
  scorecardView,
  seedCharts,
  seededViews,
  seedMeans,
  series,
  sourceOf,
  standings,
  subjectBoard,
  valueKey,
  variantMedians,
  variantSeedView,
  varyingKeys,
  wins,
  type ArtifactPoint,
  type BoardVariant,
  type EvalView,
  type VariantView,
} from './methods';

const evalView = (slug: string, direction: 'higher_is_better' | 'lower_is_better', topics: EvalView['topics']) => ({
  slug,
  displayName: slug,
  topics,
  version: '2025-01',
  links: [],
  metrics: [{ key: 'score', displayName: 'Score', aggregation: 'custom' as const, direction, headline: true }],
});
const variants: VariantView[] = [
  { id: 'm-a', slug: 'a', displayName: 'A', baseline: false, access: 'white_box' },
  { id: 'm-b', slug: 'b', displayName: 'B', baseline: false, access: 'white_box' },
  { id: 'm-raw', slug: 'raw', displayName: 'Raw', baseline: true, access: 'white_box' },
];
const SAE: MethodCompare = { groupBy: ['sites', 'width'] };
const MATCH: MethodMatch = { eval: 'sae-bench-core', metric: 'l0', targets: [40, 80], default: 80 };
const SUITE = { slug: 'saebench', displayName: 'SAEBench', matched: MATCH };
const L0 = valueKey('sae-bench-core', 'l0');
const site = { address: 'resid_post.12', role: 'read' as const, source: 'blocks.12.hook_resid_post' };
let n = 0;
const sae = (variantId: string, l0: number, scores: Record<string, number>, width?: number) =>
  ({
    id: `x${n++}`,
    key: `k${n}`,
    displayName: `${variantId} ${l0}`,
    variantId,
    subject: 'google/gemma-2-2b',
    sites: [site],
    params: (width ? { width } : {}) as ArtifactPoint['params'],
    sourceUrl: null,
    values: {
      ...(l0 ? { [L0]: l0 } : {}),
      ...Object.fromEntries(Object.entries(scores).map(([e, v]) => [valueKey(e, 'score'), v])),
    },
  }) satisfies ArtifactPoint;

describe('download', () => {
  const sha256 = 'a'.repeat(64);
  const url = 'https://huggingface.co/x/y/resolve/abc/p.pt';

  it('uses our copy when we have one, else the source', () => {
    expect(download('id1', { name: 'p.pt', url, sha256, bytes: 89128 })).toEqual({
      name: 'p.pt',
      href: url,
      from: 'Hugging Face',
      size: '89.1 KB',
    });
    const mirror = `artifacts/${sha256}/p.pt`;
    expect(download('id1', { name: 'p.pt', url, sha256, bytes: 89128, mirror })?.href).toBe(
      '/files/artifacts/id1/p.pt',
    );
    expect(download('id1', { name: 'p.pt', sha256, bytes: 1 })).toBeNull();
  });

  it('gives sizes in B, KB, MB and GB', () => {
    expect([512, 12_345, 33_600_000, 230e9].map(bytesText)).toEqual(['512 B', '12.3 KB', '33.6 MB', '230 GB']);
  });
});

describe('interpolateAt', () => {
  const pts = [
    { x: 20, y: 0.2 },
    { x: 80, y: 0.6 },
  ];
  it('reads the line between points on a log-x axis', () => {
    expect(interpolateAt(pts, 40)).toBeCloseTo(0.4);
    expect(interpolateAt(pts, 80)).toBe(0.6);
  });
  it('is null outside the points', () => {
    expect(interpolateAt(pts, 10)).toBeNull();
    expect(interpolateAt(pts, 160)).toBeNull();
    expect(interpolateAt([], 40)).toBeNull();
  });
});

describe('jobsFor', () => {
  it('sorts by name and marks the safety tasks', () => {
    const jobs = jobsFor([
      evalView('sae-bench-core', 'higher_is_better', []),
      evalView('zeta', 'higher_is_better', ['auditing']),
      evalView('sae-bench-unlearning', 'higher_is_better', ['bio_chem']),
      evalView('sae-bench-absorption', 'lower_is_better', []),
    ]);
    expect(jobs.map((j) => j.eval.slug)).toEqual([
      'sae-bench-absorption',
      'sae-bench-core',
      'sae-bench-unlearning',
      'zeta',
    ]);
    expect(jobs.map((j) => j.safety)).toEqual([false, false, true, false]);
  });
});

describe('groups', () => {
  const artifacts = [sae('m-a', 20, {}, 4096), sae('m-b', 40, {}, 16384), sae('m-raw', 0, {})];
  const base = baseOf(artifacts[0], SAE);
  it('keys a group by subject, sites and params', () => {
    expect(base).toBe('google/gemma-2-2b @ resid_post.12');
    expect(baseOf(artifacts[0], { groupBy: [] })).toBe('google/gemma-2-2b');
    expect(groupValue(artifacts[0], 'width')).toBe('4096');
    expect(groupValue({ sites: [{ role: 'read', source: 'layer 37' }], params: {} }, 'sites')).toBe('layer 37');
  });
  it('lists param values of variants, not of baselines', () => {
    expect(paramValuesIn(artifacts, variants, SAE, base, 'width')).toEqual(['4096', '16384']);
  });
  it('keeps baselines in every param group of their base', () => {
    const ids = new Set(['m-raw']);
    const got = inGroup(artifacts, SAE, { base, params: { width: '4096' } }, ids).map((a) => a.variantId);
    expect(got).toEqual(['m-a', 'm-raw']);
  });
});

describe('scorecard', () => {
  const artifacts = [
    sae('m-a', 20, { up: 0.1, down: 0.5 }),
    sae('m-a', 80, { up: 0.5, down: 0.1 }),
    sae('m-b', 40, { up: 0.6, down: 0.3 }),
    sae('m-b', 160, { up: 0.8, down: 0.2 }),
    sae('m-raw', 0, { up: 0.7 }),
  ];
  const jobs = jobsFor([evalView('up', 'higher_is_better', []), evalView('down', 'lower_is_better', [])]);
  const rows = scorecard({ variants, artifacts, jobs, xKey: L0, at: 80 });
  const row = (slug: string) => rows.find((r) => r.job.eval.slug === slug)!;

  it('ranks each direction at the same L0', () => {
    expect(row('up').cells.get('m-a')).toEqual({ value: 0.5, rank: 2 });
    expect(row('up').cells.get('m-b')?.value).toBeCloseTo(0.7);
    expect(row('up').cells.get('m-b')?.rank).toBe(1);
    expect(row('down').cells.get('m-a')).toEqual({ value: 0.1, rank: 1 });
    expect(row('down').cells.get('m-b')?.rank).toBe(2);
    expect(row('down').count).toBe(2);
  });
  it('keeps baselines out of the ranks, as references', () => {
    expect(row('up').cells.has('m-raw')).toBe(false);
    expect(row('up').baselines).toEqual([{ variant: variants[2], value: 0.7 }]);
  });
  it('gives no value outside a variant range', () => {
    const at320 = scorecard({ variants, artifacts, jobs, xKey: L0, at: 320 });
    expect([...at320[0].cells.values()]).toEqual([null, null]);
    expect(wins(at320).size).toBe(0);
  });
  it('counts first places, without the matched eval', () => {
    expect([...wins(rows)].map(([id, js]) => [id, js.map((j) => j.eval.slug)])).toEqual([
      ['m-a', ['down']],
      ['m-b', ['up']],
    ]);
    expect(wins(rows, 'up').has('m-b')).toBe(false);
  });
  it('gives first places, ranked rows and the median rank of each variant', () => {
    expect(standings(rows).get('m-a')).toEqual({ firsts: 1, of: 2, medianRank: 1.5 });
    expect(standings(rows, 'up').get('m-b')).toEqual({ firsts: 0, of: 1, medianRank: 2 });
    expect(standings(rows).has('m-raw')).toBe(false);
  });
  it('orders a series by the matched metric', () => {
    expect(series(artifacts, 'm-b', L0, valueKey('up', 'score')).map((p) => p.x)).toEqual([40, 160]);
  });
  it('uses the one artifact of each variant without a match', () => {
    const direct = scorecard({
      variants,
      artifacts: [sae('m-a', 0, { up: 0.3 }), sae('m-b', 0, { up: 0.4 })],
      jobs,
      xKey: null,
      at: null,
    });
    const at = (slug: string) => direct.find((r) => r.job.eval.slug === slug)!;
    expect(at('up').cells.get('m-b')).toEqual({ value: 0.4, rank: 1 });
    expect(at('up').cells.get('m-a')).toEqual({ value: 0.3, rank: 2 });
    expect(at('down').cells.get('m-a')).toBeNull();
  });
});

describe('seeds', () => {
  const synth = (variantId: string, targetL0: number, seed: number, mcc: number, l0 = targetL0) =>
    ({
      id: `s${n++}`,
      key: `s${n}`,
      displayName: `${variantId} ${targetL0} ${seed}`,
      variantId,
      subject: 'decoderesearch/synth-sae-bench-16k-v1',
      sites: [],
      params: { width: 4096, targetL0, seed },
      sourceUrl: null,
      values: { [valueKey('synth', 'mcc')]: mcc, [valueKey('synth', 'l0')]: l0 },
    }) satisfies ArtifactPoint;
  const metrics = [
    { key: 'mcc', displayName: 'MCC', aggregation: 'custom' as const, direction: 'higher_is_better' as const },
    { key: 'l0', displayName: 'L0', aggregation: 'custom' as const, direction: 'neither' as const },
  ];
  const artifacts = [
    synth('m-a', 25, 0, 0.7),
    synth('m-a', 25, 1, 0.8),
    synth('m-b', 25, 0, 0.9),
    synth('m-raw', 25, 0, 0.95),
    synth('m-a', 35, 0, 0.6),
  ];
  const defs = [
    { key: 'width', label: 'Width', type: 'integer' as const },
    { key: 'targetL0', label: 'Target L0', type: 'integer' as const },
    { key: 'seed', label: 'Seed', type: 'integer' as const },
  ];

  it('finds the params that differ, other than the seed', () => {
    expect(varyingKeys(artifacts, defs)).toEqual(['targetL0']);
  });
  it('gives the mean over seeds, with the standard error', () => {
    const rows = seedMeans({
      variants,
      artifacts: artifacts.filter((a) => a.params.targetL0 === 25),
      evalSlug: 'synth',
      metrics,
    });
    const a = rows.find((r) => r.variant.id === 'm-a')!.cells.get('mcc')!;
    expect(a.mean).toBeCloseTo(0.75);
    expect(a.stderr).toBeCloseTo(0.05);
    expect(a.n).toBe(2);
    expect(rows.find((r) => r.variant.id === 'm-b')!.cells.get('mcc')).toEqual({
      mean: 0.9,
      stderr: null,
      n: 1,
      rank: 1,
    });
  });
  it('ranks variants, not baselines, and only metrics with a better direction', () => {
    const rows = seedMeans({ variants, artifacts, evalSlug: 'synth', metrics });
    const cell = (id: string, m: string) => rows.find((r) => r.variant.id === id)!.cells.get(m)!;
    expect(cell('m-a', 'mcc').rank).toBe(2);
    expect(cell('m-raw', 'mcc').rank).toBeNull();
    expect(cell('m-b', 'l0').rank).toBeNull();
  });
  it('keeps the scorecard to bases with the matched metric', () => {
    const both = [sae('m-a', 20, {}), ...artifacts];
    expect([...matchedBases(both, SAE, MATCH)]).toEqual(['google/gemma-2-2b @ resid_post.12']);
    expect(matchedBases(both, { groupBy: [] }, null).size).toBe(2);
    const jobs = jobsFor([evalView('synth', 'higher_is_better', []), evalView('up', 'higher_is_better', [])]);
    expect(jobsIn(jobs, [sae('m-a', 20, { up: 0.5 })]).map((j) => j.eval.slug)).toEqual(['up']);
  });
  it('picks the defaults: the matched base, the middle width and target, the middle seeded group', () => {
    const input = {
      method: { compare: SAE },
      variants,
      params: defs,
      evals: [
        { ...evalView('up', 'higher_is_better', []), suite: SUITE },
        { ...evalView('synth', 'higher_is_better', []), metrics: [{ ...metrics[0], headline: true }, metrics[1]] },
      ],
      artifacts: [
        ...artifacts,
        synth('m-b', 35, 0, 0.5),
        synth('m-b', 45, 0, 0.5),
        ...[4096, 16384, 65536].flatMap((w) => [sae('m-a', 40, { up: 0.5 }, w), sae('m-b', 90, { up: 0.6 }, w)]),
      ],
    };
    const view = scorecardView(input, {});
    expect(view.suite?.slug).toBe('saebench');
    expect([view.base, view.picked.width, view.at]).toEqual(['google/gemma-2-2b @ resid_post.12', '16384', 80]);
    expect(view.rows.map((r) => r.job.eval.slug)).toEqual(['up']);
    expect(scorecardView(input, { width: '4096', at: '40' }).picked.width).toBe('4096');
    const [seeded] = seededViews(input, {});
    expect([seeded.key, seeded.values, seeded.value, seeded.seeds]).toEqual(['targetL0', ['25', '35', '45'], '35', 2]);
    expect(seededViews(input, { targetL0: '25' })[0].rows.map((r) => r.variant.id)).toEqual(['m-a', 'm-b', 'm-raw']);
  });
  it('gives one variant on one eval: each group, with its seeds', () => {
    const input = {
      variants,
      params: defs,
      evals: [
        { ...evalView('synth', 'higher_is_better', []), metrics: [{ ...metrics[0], headline: true }, metrics[1]] },
      ],
      artifacts: [...artifacts, synth('m-b', 35, 0, 0.5)],
    };
    const view = variantSeedView(input, 'm-a', 'synth')!;
    expect([view.key, view.values]).toEqual(['targetL0', ['25', '35']]);
    expect(
      view.groups.map((g) => [g.value, g.of, g.means.find((r) => r.variant.id === 'm-a')?.cells.get('mcc')?.rank]),
    ).toEqual([
      ['25', 2, 2],
      ['35', 2, 1],
    ]);
    expect(view.seeds.map((s) => [s.value, s.seed, s.values.mcc])).toEqual([
      ['25', 0, 0.7],
      ['25', 1, 0.8],
      ['35', 0, 0.6],
    ]);
    expect(variantSeedView(input, 'm-a', 'other')).toBeNull();
    expect(variantSeedView({ ...input, artifacts }, 'm-c', 'synth')).toBeNull();
  });
  it('puts a baseline with no target L0 and another width in each group', () => {
    const fixed = (seed: number, mcc: number) => {
      const a = synth('m-raw', 0, seed, mcc, 360);
      return { ...a, params: { width: 768, seed } };
    };
    const input = {
      method: { compare: SAE },
      variants,
      params: defs,
      evals: [
        { ...evalView('synth', 'higher_is_better', []), metrics: [{ ...metrics[0], headline: true }, metrics[1]] },
      ],
      artifacts: [...artifacts.filter((a) => a.variantId !== 'm-raw'), fixed(0, 0.6), fixed(1, 0.62)],
    };
    const [seeded] = seededViews(input, { targetL0: '35' });
    expect([seeded.key, seeded.values]).toEqual(['targetL0', ['25', '35']]);
    const raw = seeded.rows.find((r) => r.variant.id === 'm-raw')!.cells.get('mcc')!;
    expect([raw.mean, raw.n, raw.rank]).toEqual([0.61, 2, null]);
    const view = variantSeedView(input, 'm-raw', 'synth')!;
    expect(
      view.groups.map((g) => [g.value, g.means.find((r) => r.variant.id === 'm-raw')?.cells.get('mcc')?.n]),
    ).toEqual([
      ['25', 2],
      ['35', 2],
    ]);
    expect(view.seeds.map((s) => s.value)).toEqual(['', '']);
    const [chart] = seedCharts(view, variants, 'm-raw');
    expect([chart.current.points.map((p) => p.x), chart.seeds]).toEqual([[25, 35], []]);
  });
});

describe('subjectBoard', () => {
  const method = { slug: 'probes', displayName: 'Probes' };
  const board: BoardVariant[] = [
    { ...variants[0], method },
    { ...variants[1], method },
    { ...variants[2], method },
  ];
  const at = (variantId: string, subject: string, v: number) => ({
    ...sae(variantId, 0, { lie: v }),
    subject,
  });
  const rows = subjectBoard({
    variants: board,
    artifacts: [
      at('m-a', 'x/small', 0.7),
      at('m-b', 'x/small', 0.8),
      at('m-raw', 'x/small', 0.9),
      at('m-a', 'x/big', 0.6),
    ],
    key: valueKey('lie', 'score'),
    direction: 'higher_is_better',
    order: { label: 'Index', sourceUrl: 'https://example.com', values: [{ subject: 'x/big', value: 50 }] },
  });
  it('sorts rows by the order value, then by name', () => {
    expect(rows.map((r) => r.subject)).toEqual(['x/big', 'x/small']);
    expect(rows[0].order).toBe(50);
    expect(rows[1].order).toBeNull();
  });
  it('ranks variants in each row and keeps baselines apart', () => {
    expect(rows[1].cells.get('m-b')?.rank).toBe(1);
    expect(rows[1].cells.get('m-a')?.rank).toBe(2);
    expect(rows[1].cells.has('m-raw')).toBe(false);
    expect(rows[1].baselineValues.get('m-raw')).toBe(0.9);
    expect(rows[0].cells.get('m-a')?.rank).toBe(1);
  });
  it('gives medians over models, best first, with baselines', () => {
    expect(
      variantMedians(rows, board, 'higher_is_better').map((m) => [m.variant.id, +m.median.toFixed(4), m.count]),
    ).toEqual([
      ['m-raw', 0.9, 1],
      ['m-b', 0.8, 1],
      ['m-a', 0.65, 2],
    ]);
  });
  it('with core models, gives medians over them, only for variants with a value on each', () => {
    const median = (core: string[]) =>
      variantMedians(rows, board, 'higher_is_better', core).map((m) => [m.variant.id, +m.median.toFixed(4), m.count]);
    expect(median(['x/big'])).toEqual([['m-a', 0.6, 1]]);
    expect(median(['x/big', 'x/small'])).toEqual([['m-a', 0.65, 2]]);
    expect(median(['x/other'])).toEqual([]);
    expect(coreCount(rows, 'm-b', ['x/big', 'x/small'])).toBe(1);
  });
  it('finds two artifacts of one variant on one model', () => {
    expect(oneEach([at('m-a', 'x/small', 0.7), at('m-b', 'x/small', 0.8)])).toBe(true);
    expect(oneEach([at('m-a', 'x/small', 0.7), at('m-a', 'x/small', 0.8)])).toBe(false);
  });
});

describe('metricMedians', () => {
  it('ranks the median of each variant on each metric that two variants have', () => {
    const e = {
      ...evalView('lens', 'higher_is_better', []),
      metrics: [
        { key: 'score', displayName: 'Score', aggregation: 'custom' as const, direction: 'higher_is_better' as const },
        { key: 'loss', displayName: 'Loss', aggregation: 'custom' as const, direction: 'lower_is_better' as const },
        { key: 'raw', displayName: 'Raw', aggregation: 'custom' as const, direction: 'neither' as const },
        { key: 'only', displayName: 'Only', aggregation: 'custom' as const, direction: 'higher_is_better' as const },
      ],
    };
    const art = (variantId: string, values: Record<string, number>) =>
      ({
        ...sae(variantId, 0, {}),
        values: Object.fromEntries(Object.entries(values).map(([k, v]) => [valueKey('lens', k), v])),
      }) satisfies ArtifactPoint;
    const rows = metricMedians(
      { eval: e, metric: e.metrics[0], safety: false },
      [
        art('m-a', { score: 0.2, loss: 3, raw: 1, only: 1 }),
        art('m-a', { score: 0.4, loss: 1, raw: 1 }),
        art('m-b', { score: 0.5, loss: 4, raw: 2 }),
        art('m-raw', { score: 0.9, loss: 0 }),
      ],
      variants,
    );
    expect(rows.map((r) => r.job.metric.key)).toEqual(['score', 'loss']);
    expect(rows.map((r) => [r.cells.get('m-a'), r.cells.get('m-b'), r.count])).toEqual([
      [{ value: 0.30000000000000004, rank: 2 }, { value: 0.5, rank: 1 }, 2],
      [{ value: 2, rank: 1 }, { value: 4, rank: 2 }, 2],
    ]);
  });
});

describe('median and formatParam', () => {
  it('finds the middle value', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
  it('shortens widths', () => {
    expect(formatParam({ key: 'width', label: 'Width', type: 'integer' }, 16384)).toBe('16k');
    expect(formatParam({ key: 'width', label: 'Width', type: 'integer' }, '1000')).toBe('1,000');
    expect(formatParam(undefined, 'openai/gpt-5.5-pro')).toBe('openai/gpt-5.5-pro');
  });
  it('keeps small numbers and writes booleans as words', () => {
    expect(formatParam({ key: 'lr', label: 'LR', type: 'number' }, 0.0003)).toBe('0.0003');
    expect(formatParam({ key: 'n', label: 'N', type: 'number' }, 1234.5)).toBe('1,234.5');
    expect(formatParam({ key: 'on', label: 'On', type: 'boolean' }, true)).toBe('Yes');
  });
  it('adds the unit, with no space before a percent sign', () => {
    expect(paramText({ key: 'width', label: 'Width', type: 'integer', unit: 'latents' }, 16384)).toBe('16k latents');
    expect(paramText({ key: 'depth', label: 'Depth', type: 'integer', unit: '%' }, 70)).toBe('70%');
    expect(paramText({ key: 'depth', label: 'Depth', type: 'integer', unit: '%' }, undefined)).toBe('');
  });
});

describe('formatValue', () => {
  it('keeps 3 decimals below 10', () => {
    expect(formatValue(0.12345)).toBe('0.123');
    expect(formatValue(-0.0456)).toBe('-0.046');
    expect(formatValue(1)).toBe('1.000');
    expect(formatValue(81.25)).toBe('81.3');
    expect(formatValue(2302.03)).toBe('2,302');
  });
});

describe('methodPathOf', () => {
  it('reads method and variant pages', () => {
    expect(methodPathOf('/methods/probes')).toBe('/methods/probes');
    expect(methodPathOf('/methods/probes/dyl?x=1#top')).toBe('/methods/probes/dyl');
  });

  it('gives null for other pages', () => {
    for (const href of ['/methods', '/methods/leaderboards', '/methods/probes/artifacts', '/methods/a/b/c', '/x/y'])
      expect(methodPathOf(href)).toBeNull();
  });
});

describe('oneOf', () => {
  it('makes a plural method name singular, with its article', () => {
    expect(oneOf('Workspace Lenses')).toEqual({ article: 'a', name: 'Workspace Lens' });
    expect(oneOf('Probes')).toEqual({ article: 'a', name: 'Probe' });
    expect(oneOf('LLM Monitors')).toEqual({ article: 'an', name: 'LLM Monitor' });
    expect(oneOf('Sparse Autoencoders')).toEqual({ article: 'a', name: 'Sparse Autoencoder' });
  });
});

describe('sourceOf', () => {
  const of = (title: string, url = 'https://example.com/post') => sourceOf([{ kind: 'paper', url, title }]);

  it('reads "et al." authors and the month of an arXiv ID', () => {
    expect(of('Gao et al., Scaling and evaluating sparse autoencoders', 'https://arxiv.org/abs/2406.04093')).toEqual({
      author: 'Gao et al.',
      date: '2024-06',
    });
  });

  it('reads a list of authors, and a blog with its month in the title', () => {
    expect(of('Cooney, Africa and Irving (2026)', 'https://arxiv.org/abs/2606.12618')).toEqual({
      author: 'Cooney, Africa and Irving',
      date: '2026-06',
    });
    expect(of('Anthropic, Circuits Updates (April 2024)')).toEqual({ author: 'Anthropic', date: '2024-04' });
    expect(of('Cooney, Africa and Irving (2026)')).toEqual({ author: 'Cooney, Africa and Irving', date: '2026' });
  });

  it('reads one author before a title that has "and" in it', () => {
    expect(of('Bhatia, O-Lens s3d.rl600 and its activation reconstructor (September 2026)')).toEqual({
      author: 'Bhatia',
      date: '2026-09',
    });
  });

  it('does not read the text after the year', () => {
    expect(of('Cooney, Africa and Irving (2026), Appendix D', 'https://arxiv.org/abs/2606.12618')).toEqual({
      author: 'Cooney, Africa and Irving',
      date: '2026-06',
    });
  });

  it('gives nulls with no link or title', () => {
    expect(sourceOf([])).toEqual({ author: null, date: null });
    expect(sourceOf([{ kind: 'paper', url: 'https://arxiv.org/abs/2406.04093' }])).toEqual({
      author: null,
      date: null,
    });
  });
});

describe('newestFirst', () => {
  it('puts the newest date first, a year after its months and no date last, and keeps ties in order', () => {
    const v = (label: string, date: string | null) => ({ label, date });
    const out = newestFirst([
      v('logit', '2020'),
      v('none', null),
      v('j', '2026-07'),
      v('jpp', '2026-10'),
      v('year', '2026'),
      v('r', '2026-08'),
      v('r2', '2026-08'),
    ]);
    expect(out.map((x) => x.label)).toEqual(['jpp', 'r', 'r2', 'j', 'year', 'logit', 'none']);
  });
});
