import { ASK_KNOWLEDGE } from '@/lib/ask/knowledge';
import { ASK_TOURS, pageKind, readablePage, splitTours, toursFor } from '@/lib/ask/pages';
import { CONTRIBUTE_WAYS, type ContributeWay } from '@/lib/contribute';
import { FAQ_SECTIONS } from '@/lib/faqs';
import { WHY_REASONS } from '@/lib/why';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = join(__dirname, '..', '..', 'app');

/** Each route in `app/` as its segments: `[x]` is any one segment; groups and slots are left out. */
function routes(dir = APP, at: string[] = []): string[][] {
  const out: string[][] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name.startsWith('@') || name === 'api' || name === 'admin') continue;
      out.push(...routes(path, /^\(.*\)$/.test(name) ? at : [...at, name]));
    } else if (/^(page|route)\.tsx?$/.test(name)) out.push(at);
  }
  return out;
}
const ROUTES = routes();

/** True when `path` (with `<x>` for any segment) is a page or route of the site. */
function exists(path: string) {
  const parts = path.split(/[?#]/)[0].split('/').filter(Boolean);
  return ROUTES.some(
    (r) =>
      r.length === parts.length &&
      r.every((seg, i) => seg === parts[i] || (seg.startsWith('[') && !TOP(parts[i])) || parts[i].startsWith('<')),
  );
}
/** A static folder name: a dynamic segment cannot be one. */
const TOP = (s: string) => ROUTES.some((r) => r[0] === s) && !s.startsWith('<');

/** The internal paths in the knowledge: markdown links, and paths after a space or "(". */
const PATHS = [
  ...new Set(
    [...ASK_KNOWLEDGE.matchAll(/(?:\]\(|[\s(])(\/[A-Za-z0-9<>_.\-/]*[A-Za-z0-9>_\-](?:\?[^\s)#]*)?(?:#[\w-]+)?)/g)].map(
      (m) => m[1],
    ),
  ),
];

const ids = (ways: ContributeWay[]): string[] => ways.flatMap((w) => [w.id, ...ids(w.items ?? [])]);
const ANCHORS: Record<string, string[]> = {
  '/faqs': FAQ_SECTIONS.flatMap((s) => [s.id, ...s.faqs.map((f) => f.id)]),
  '/features': WHY_REASONS.map((r) => r.id),
  '/contribute': ['tldr', ...ids(CONTRIBUTE_WAYS)],
};

describe('the assistant knowledge', () => {
  it('has the sources', () => {
    for (const head of ['# The pages', '# OpenAudit Features', '# Frequently Asked Questions', '# How to Contribute'])
      expect(ASK_KNOWLEDGE).toContain(head);
    expect(PATHS.length).toBeGreaterThan(50);
  });

  it('names only pages that exist', () => {
    expect(PATHS.filter((p) => !exists(p))).toEqual([]);
  });

  it('links only to anchors that exist', () => {
    const bad = PATHS.filter((p) => {
      const [page, anchor] = p.split('#');
      return anchor && ANCHORS[page] && !ANCHORS[page].includes(anchor);
    });
    expect(bad).toEqual([]);
  });
});

describe('pages and tours', () => {
  it('knows the kind of each page', () => {
    expect(pageKind('/')).toBe('home');
    expect(pageKind('/google/gemini-3.1-flash-lite')).toBe('model');
    expect(pageKind('/google/gemini-3.1-flash-lite?tab=system-card')).toBe('model system card');
    expect(pageKind('/anthropic')).toBe('organization');
    expect(pageKind('/anthropic/commitments/rd-pause')).toBe('organization commitment');
    expect(pageKind('/evaluations/agentharm')).toBe('evaluation');
    expect(pageKind('/runs/abc/attempts/3')).toBe('attempt');
    expect(pageKind('/methods/probes/apollo')).toBe('method variant');
    expect(pageKind('/faqs')).toBe('faqs');
  });

  it('reads no page of eval content', () => {
    for (const p of ['/runs/a/attempts/1', '/runs/a/samples/s', '/samples/x', '/evaluations/agentharm/samples'])
      expect(readablePage(p)).toBe(false);
    for (const p of ['/evaluations/known-errors', '/evaluations/wmdp/known-errors', '/judges/a/b/c'])
      expect(readablePage(p)).toBe(false);
    for (const p of ['/', '/runs/a', '/evaluations/agentharm', '/methods/probes', '/anthropic', '/judges/a/b'])
      expect(readablePage(p)).toBe(true);
  });

  it('offers tours that show known kinds of page', () => {
    for (const t of ASK_TOURS) expect(t.kinds.filter((k) => k === 'site page')).toEqual([]);
    expect(toursFor('/').map((t) => t.id)).toEqual(['home', 'short']);
    expect(toursFor('/organizations/commitments').map((t) => t.id)).toContain('safety-coordination');
  });

  it('reads the tour tags of an answer', () => {
    const { text, tours } = splitTours('The tour shows the dashboard.\n\n[tour:safety-coordination]');
    expect(text).toBe('The tour shows the dashboard.');
    expect(tours.map((t) => t.id)).toEqual(['safety-coordination']);
    expect(splitTours('Try it. [tour:nothing]').tours).toEqual([]);
    expect(splitTours('Streaming [tou').text).toBe('Streaming');
    expect(splitTours('A [tour:ho').text).toBe('A');
    expect(splitTours('Read [the FAQs](/faqs).').text).toBe('Read [the FAQs](/faqs).');
  });
});
