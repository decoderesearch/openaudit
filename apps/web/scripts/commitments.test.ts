import schema from '@openaudit/spec/schema.json' with { type: 'json' };
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { crossProblems, noteProblems, parseCommitment, stateProblems, type CommitmentFile } from './commitments';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(schema);
const validate = (type: string, record: unknown) => {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`)!;
  return check(record) ? null : ajv.errorsText(check.errors);
};

const FILE = 'data/seed/commitments/embedded-evaluators.json';
const URL = 'https://openai.com/index/our-first-phase-of-embedded-assessments/';
const BY = 'Claude Opus 5.5 (High)';
const event = (over: Record<string, unknown> = {}) => ({
  date: '2026-11-16',
  kind: 'announced',
  title: 'Signs agreements with four embedded assessors',
  summary: 'A first phase.',
  quote: { text: 'We have signed agreements', url: URL },
  sources: [{ url: URL, publisher: 'OpenAI' }],
  state: {
    level: 'partial',
    strength: 'agreement',
    duration: 'time_limited',
    criteria: { 'deep-access': 'met', permanent: 'not_met' },
    notes: {
      'deep-access': { commitment: 'Checkpoints and staff.', missing: 'No outside check.' },
      permanent: { missing: 'A pilot only.' },
    },
    limits: ['Lab can redact'],
  },
  ...over,
});
const file = (orgs: unknown[], over: Record<string, unknown> = {}) =>
  JSON.stringify({
    slug: 'embedded-evaluators',
    name: 'Embedded Evaluators',
    category: 'oversight',
    order: 0,
    summary: 'Independent assessors work inside the lab.',
    description: 'Why it matters.',
    criteria: [
      { key: 'deep-access', label: 'Deep Access', description: 'Checkpoints and staff.' },
      { key: 'permanent', label: 'Permanent', description: 'No end date.' },
    ],
    orgs,
    ...over,
  });
const parse = (text: string) => parseCommitment(text, FILE, validate, new Set(['openai', 'anthropic']));

describe('parseCommitment', () => {
  it('reads an organization with events, and one with none', () => {
    const r = parse(
      file([
        { org: 'openai', checkedAt: '2026-11-16', checkedBy: BY, summary: 'A first phase.', events: [event()] },
        { org: 'anthropic', checkedAt: '2026-11-16', checkedBy: BY, events: [] },
      ]),
    );
    expect(r.problems).toEqual([]);
    const [openai, anthropic] = r.parsed!.orgs;
    expect(openai.checkedBy).toBe(BY);
    expect(openai.state.level).toBe('partial');
    expect(openai.events[0]).toMatchObject({ order: 0, datePrecision: 'day' });
    expect(anthropic.state).toEqual({ level: 'none_found', criteria: {}, limits: [] });
  });

  it('takes the state of the newest event', () => {
    const later = event({
      date: '2027',
      kind: 'withdrawn',
      title: 'Ends the program',
      state: {
        level: 'dropped',
        criteria: {},
        notes: { 'deep-access': { missing: 'Ended.' }, permanent: { missing: 'Ended.' } },
        limits: [],
      },
    });
    const r = parse(
      file([{ org: 'openai', checkedAt: '2027-01-01', checkedBy: BY, summary: 'Ended.', events: [event(), later] }]),
    );
    expect(r.problems).toEqual([]);
    expect(r.parsed!.orgs[0].state.level).toBe('dropped');
    expect(r.parsed!.orgs[0].events[1].datePrecision).toBe('year');
  });

  it('refuses a bad file', () => {
    const cases: [unknown[], string][] = [
      [[{ org: 'nobody', checkedAt: '2026-11-16', events: [] }], 'no organization has this slug'],
      [[{ org: 'openai', checkedAt: '2026-11', events: [] }], 'checkedAt must be a day'],
      [[{ org: 'openai', checkedAt: '2026-11-16', events: [] }], 'checkedBy must name the model'],
      [[{ org: 'openai', checkedAt: '2026-11-16', checkedBy: ' ', events: [] }], 'checkedBy must name the model'],
      [[{ org: 'openai', checkedAt: '2026-11-16', events: [event()] }], 'needs a summary'],
      [[{ org: 'openai', checkedAt: '2026-11-01', summary: 'x', events: [event()] }], 'after checkedAt'],
      [
        [
          {
            org: 'openai',
            checkedAt: '2026-11-16',
            summary: 'x',
            events: [event({ date: '2026-11' }), event({ date: '2026-01' })],
          },
        ],
        'oldest first',
      ],
      [
        [
          { org: 'openai', checkedAt: '2026-11-16', events: [] },
          { org: 'openai', checkedAt: '2026-11-16', events: [] },
        ],
        'listed twice',
      ],
      [[{ org: 'openai', checkedAt: '2026-11-16', summary: 'x', events: [event({ kind: 'started' })] }], 'kind'],
      [[{ org: 'openai', checkedAt: '2026-11-16', summary: 'x', events: [event({ sources: [] })] }], 'sources'],
      [
        [
          {
            org: 'openai',
            checkedAt: '2026-11-16',
            summary: 'x',
            events: [event({ state: { ...event().state, notes: {} } })],
          },
        ],
        'the newest state needs a note for deep-access',
      ],
    ];
    for (const [orgs, want] of cases) {
      const r = parse(file(orgs));
      expect(r.parsed, want).toBeUndefined();
      expect(r.problems.join('\n'), want).toContain(want);
    }
  });

  it('wants the slug of the file name', () => {
    expect(parse(file([], { slug: 'other' })).problems.join()).toContain('slug must be embedded-evaluators');
  });
});

describe('stateProblems', () => {
  const keys = ['deep-access', 'permanent'];
  const state = (level: string, criteria: Record<string, string>, more = {}) =>
    ({ level, criteria, limits: [], strength: 'policy', ...more }) as Parameters<typeof stateProblems>[0];

  it('checks the level against the criteria and verified', () => {
    const allMet = { 'deep-access': 'met', permanent: 'met' };
    expect(stateProblems(state('full', allMet, { verified: keys }), keys)).toEqual([]);
    expect(stateProblems(state('full', allMet, { verified: ['permanent'] }), keys)).toContain(
      'level full needs each criterion met and verified',
    );
    expect(stateProblems(state('full', { 'deep-access': 'met' }, { verified: keys }), keys)).toContain(
      'level full needs each criterion met and verified',
    );
    expect(stateProblems(state('partial', allMet), keys)).toEqual([]);
    expect(stateProblems(state('partial', allMet, { verified: keys }), keys)).toContain(
      'level partial, but each criterion is met and verified',
    );
    expect(stateProblems(state('intent', { 'deep-access': 'not_met' }), keys)).toEqual([]);
    expect(stateProblems(state('intent', { 'deep-access': 'partly' }), keys)).toContain(
      'level intent, but a criterion is met or partly met: use partial',
    );
    expect(stateProblems(state('partial', {}, { notes: { other: 'x' } }), keys)).toContain(
      'note other is not a criterion of the commitment',
    );
    expect(stateProblems(state('partial', { other: 'met' }), keys)).toContain(
      'criterion other is not in the commitment',
    );
  });

  it('wants a commitment for each met criterion, and missing unless met and verified', () => {
    const marks = { 'deep-access': 'met', permanent: 'partly' };
    const notes = (n: object) => state('partial', marks, { verified: ['deep-access'], notes: n });
    expect(
      noteProblems(notes({ 'deep-access': { commitment: 'a' }, permanent: { commitment: 'b', missing: 'c' } }), keys),
    ).toEqual([]);
    expect(noteProblems(notes({ 'deep-access': { commitment: 'a' } }), keys)).toEqual([
      'the newest state needs a note for permanent',
    ]);
    expect(
      noteProblems(notes({ 'deep-access': { commitment: 'a', missing: 'x' }, permanent: { missing: 'c' } }), keys),
    ).toEqual(['note deep-access is met and verified, so nothing is missing', 'note permanent needs commitment']);
    expect(noteProblems(notes({ 'deep-access': { commitment: 'a' }, permanent: { commitment: 'b' } }), keys)).toEqual([
      'note permanent needs missing',
    ]);
  });

  it('wants each verified criterion met or partly met', () => {
    const marks = { 'deep-access': 'partly', permanent: 'not_met' };
    expect(stateProblems(state('partial', marks, { verified: ['deep-access'] }), keys)).toEqual([]);
    expect(stateProblems(state('partial', marks, { verified: ['permanent'] }), keys)).toContain(
      'verified permanent needs the criterion met or partly met',
    );
  });

  it('wants a strength for a commitment, and none_found only with no events', () => {
    expect(stateProblems(state('intent', {}, { strength: undefined }), keys)).toContain(
      'level intent needs a strength',
    );
    expect(stateProblems(state('declined', {}, { strength: undefined }), keys)).toEqual([]);
    expect(stateProblems(state('none_found', {}), keys)).toContain(
      'none_found is only for an organization with no events',
    );
    expect(stateProblems(state('intent', {}, { endDate: '2027' }), keys)).toContain(
      'endDate needs duration time_limited',
    );
  });
});

describe('crossProblems', () => {
  it('wants each order once', () => {
    const one = (slug: string, order: number) =>
      ({ commitment: { slug, order }, orgs: [] }) as unknown as CommitmentFile;
    expect(crossProblems([one('a', 0), one('b', 1)])).toEqual([]);
    expect(crossProblems([one('a', 0), one('b', 0)])).toEqual(['b and a have the same order 0']);
  });
});
