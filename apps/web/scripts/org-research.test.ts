import schema from '@openaudit/spec/schema.json' with { type: 'json' };
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { badUrls, dropNulls, isWebUrl, markdownLinks, parseResearch, researchOrganization } from './org-research';

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats.default(ajv);
ajv.addSchema(schema);
const validate = (type: string, record: unknown) => {
  const check = ajv.getSchema(`${schema.$id}#/$defs/${type}`)!;
  return check(record) ? null : ajv.errorsText(check.errors);
};

const incident = {
  slug: '2023-forum-breach',
  title: 'Forum Breach',
  date: '2023-04',
  datePrecision: 'month',
  endDate: null,
  severity: 'orange',
  status: 'resolved',
  primaryCategory: 'systems_breached',
  categories: ['security'],
  summary: 'A hacker reportedly got in, [according to the NYT](https://www.nytimes.com/x).',
  description: 'Text.',
  timeline: [
    { date: '2023-04', datePrecision: 'month', title: 'Breach', description: 'One.', sources: ['https://a.example/1'] },
    {
      date: '2024-07-04',
      datePrecision: 'day',
      title: 'Report',
      description: 'Two.',
      sources: [{ title: 'T', url: 'https://a.example/2' }],
    },
  ],
  sources: [{ title: 'T', url: 'https://www.nytimes.com/x', publisher: 'NYT', date: '2024-07-04' }],
};
const file = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    slug: 'openai',
    name: 'OpenAI',
    website: 'https://openai.com',
    aliases: ['openai'],
    summary: 'An AI company.',
    researchDepth: 'deep',
    researchedAt: '2026-10-02',
    incidents: [incident],
    departures: [
      {
        name: 'A Person',
        title: 'Lead',
        departedDate: '2024-05',
        datePrecision: 'month',
        kind: 'resigned',
        reason: 'Said so.',
        quote: null,
        image: {
          url: 'https://upload.wikimedia.org/a.jpg',
          filePage: 'https://commons.wikimedia.org/wiki/File:A.jpg',
          license: 'CC BY 4.0',
          author: 'B',
        },
        website: null,
        nextRole: null,
        sources: [{ title: 'T', url: 'https://a.example/4' }],
      },
    ],
    ...over,
  });

describe('parseResearch', () => {
  it('reads a valid file into spec records', () => {
    const { research, problems, notes } = parseResearch(file(), 'openai.json', validate);
    expect(problems).toEqual([]);
    expect(research!.profile).toEqual({
      website: 'https://openai.com',
      summary: 'An AI company.',
      researchedAt: '2026-10-02',
      researchDepth: 'deep',
    });
    const [i] = research!.incidents;
    expect(i).not.toHaveProperty('endDate');
    expect(i.timeline.map((e) => [e.order, e.sources])).toEqual([
      [0, [{ url: 'https://a.example/1' }]],
      [1, [{ title: 'T', url: 'https://a.example/2' }]],
    ]);
    expect(research!.departures[0].image?.pageUrl).toBe('https://commons.wikimedia.org/wiki/File:A.jpg');
    expect(notes.join()).toMatch(/filePage/);
  });

  it('refuses a file that is not JSON, with a clear error', () => {
    const { research, problems } = parseResearch('{"slug": "x",', 'x.json', validate);
    expect(research).toBeUndefined();
    expect(problems[0]).toMatch(/^x\.json: not valid JSON/);
  });

  it('refuses unknown keys, a missing list and a bad severity', () => {
    expect(parseResearch(file({ extra: 1 }), 'f', validate).problems.join()).toMatch(/unknown keys extra/);
    expect(parseResearch(file({ investors: [] }), 'f', validate).problems.join()).toMatch(/unknown keys investors/);
    const impact = parseResearch(file({ incidents: [{ ...incident, primaryImpact: 'x' }] }), 'f', validate);
    expect(impact.problems.join()).toMatch(/incident 2023-forum-breach: .*additional properties/);
    expect(parseResearch(file({ incidents: undefined }), 'f', validate).problems.join()).toMatch(
      /incidents must be an array/,
    );
    const bad = parseResearch(file({ incidents: [{ ...incident, severity: 'purple' }] }), 'f', validate);
    expect(bad.research).toBeUndefined();
    expect(bad.problems.join()).toMatch(/incident 2023-forum-breach.*severity/);
  });

  it('refuses an incident with no safety category', () => {
    const copyright = { ...incident, categories: ['copyright', 'legal'] };
    const p = parseResearch(file({ incidents: [copyright] }), 'f', validate);
    expect(p.research).toBeUndefined();
    expect(p.problems.join()).toMatch(/incident 2023-forum-breach: needs a safety category/);
  });

  it('reads incident models as names, [] when left out, and refuses bad names', () => {
    expect(parseResearch(file(), 'f', validate).research!.incidents[0].models).toEqual([]);
    const named = { ...incident, models: ['openai/gpt-4o', 'openai/unreleased-hf-hack'] };
    const ok = parseResearch(file({ incidents: [named] }), 'f', validate);
    expect(ok.problems).toEqual([]);
    expect(ok.research!.incidents[0].models).toEqual(['openai/gpt-4o', 'openai/unreleased-hf-hack']);
    expect(ok.research!.incidents[0]).not.toHaveProperty('modelIds');
    for (const models of [['gpt-4o'], 'openai/gpt-4o', ['openai/gpt-4o', 'openai/gpt-4o']]) {
      const bad = parseResearch(file({ incidents: [{ ...incident, models }] }), 'f', validate);
      expect(bad.research).toBeUndefined();
      expect(bad.problems.join()).toMatch(/incident 2023-forum-breach: models/);
    }
  });

  it('refuses URLs that are not http(s), also in Markdown links', () => {
    const p1 = parseResearch(file({ website: 'ftp://openai.com' }), 'f', validate).problems.join();
    expect(p1).toMatch(/website/);
    const md = { ...incident, description: 'See [this](javascript:alert(1)).' };
    const p2 = parseResearch(file({ incidents: [md] }), 'f', validate).problems.join();
    expect(p2).toMatch(/not an http\(s\) URL: description link: javascript:alert/);
  });

  it('refuses a date that does not agree with its precision, and duplicates', () => {
    const p = parseResearch(
      file({
        incidents: [
          { ...incident, datePrecision: 'day' },
          { ...incident, datePrecision: 'month' },
        ],
      }),
      'f',
      validate,
    ).problems.join('\n');
    expect(p).toMatch(/2023-04 does not agree with datePrecision day/);
    expect(p).toMatch(/incident slug used twice: 2023-forum-breach/);
  });

  it('refuses a researchRuns key', () => {
    expect(parseResearch(file({ researchRuns: [] }), 'f', validate).problems).toEqual(['f: unknown keys researchRuns']);
  });
});

describe('helpers', () => {
  it('dropNulls leaves out nulls and blank strings at all levels', () => {
    expect(dropNulls({ a: null, v: ' ', b: [1, null, '', { c: null, d: 2 }] })).toEqual({ b: [1, { d: 2 }] });
  });

  it('isWebUrl accepts only http and https', () => {
    expect(isWebUrl('https://a.example/x?y=1')).toBe(true);
    expect(isWebUrl('http://a.example')).toBe(true);
    expect(isWebUrl('mailto:a@b.c')).toBe(false);
    expect(isWebUrl('https://a.example/a b')).toBe(false);
    expect(isWebUrl('www.a.example')).toBe(false);
  });

  it('markdownLinks finds inline and angle-bracket links', () => {
    expect(markdownLinks('[a](https://x.example/1) and <https://y.example> [b](/qwen "t")')).toEqual([
      'https://x.example/1',
      '/qwen',
      'https://y.example',
    ]);
    expect(badUrls({ reason: '[a](data:text/html,x)', url: 'https://ok.example' })).toEqual([
      'reason link: data:text/html,x',
    ]);
  });

  it('researchOrganization matches the slug or an old slug', () => {
    const orgs = [
      { slug: 'qwen', slugAliases: ['alibaba'] },
      { slug: 'openai', slugAliases: [] },
    ];
    expect(researchOrganization(['alibaba'], orgs)?.slug).toBe('qwen');
    expect(researchOrganization(['nope', 'OpenAI'], orgs)?.slug).toBe('openai');
    expect(researchOrganization(['nope'], orgs)).toBeUndefined();
  });
});
