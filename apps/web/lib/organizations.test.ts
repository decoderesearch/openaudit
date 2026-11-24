import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESERVED_HANDLES } from './handles';
import { TOP_LEVEL_ROUTES, organizationPath, resolveOrganization, slugKey } from './organizations';

const ORGS = [
  { slug: 'qwen', slugAliases: ['alibaba'] },
  { slug: 'bytedance', slugAliases: ['bytedance-seed'] },
  { slug: 'openai', slugAliases: ['openai-community'] },
];

describe('resolveOrganization', () => {
  it('shows the page for the slug itself', () => {
    expect(resolveOrganization('qwen', ORGS)).toEqual({ org: ORGS[0], redirect: false });
    expect(resolveOrganization('openai', ORGS)).toEqual({ org: ORGS[2], redirect: false });
  });

  it('redirects an alias, the old slug and other letter cases to the slug', () => {
    for (const segment of ['alibaba', 'Alibaba', 'Qwen', 'QWEN']) {
      expect(resolveOrganization(segment, ORGS)).toEqual({ org: ORGS[0], redirect: true });
    }
    for (const segment of ['bytedance-seed', 'ByteDance-Seed', 'ByteDance']) {
      expect(resolveOrganization(segment, ORGS)).toEqual({ org: ORGS[1], redirect: true });
    }
  });

  it('decodes the segment', () => {
    expect(resolveOrganization('%51wen', ORGS)).toEqual({ org: ORGS[0], redirect: true });
  });

  it('finds nothing for an unknown or malformed name', () => {
    expect(resolveOrganization('nope', ORGS)).toBeNull();
    expect(resolveOrganization('qwen-', ORGS)).toBeNull();
    expect(resolveOrganization('%E0%A4%A', ORGS)).toBeNull();
    expect(resolveOrganization('a b', ORGS)).toBeNull();
  });

  it('prefers a slug over another organization alias', () => {
    const orgs = [
      { slug: 'a', slugAliases: ['b'] },
      { slug: 'b', slugAliases: [] },
    ];
    expect(resolveOrganization('b', orgs)?.org.slug).toBe('b');
  });
});

describe('slugKey and organizationPath', () => {
  it('lowercases and checks the slug pattern', () => {
    expect(slugKey('ByteDance-Seed')).toBe('bytedance-seed');
    expect(slugKey('01-ai')).toBe('01-ai');
    expect(slugKey('llms.txt')).toBeNull();
    expect(slugKey('x'.repeat(65))).toBeNull();
  });

  it('puts the page at the top level', () => {
    expect(organizationPath({ slug: 'qwen' })).toBe('/qwen');
  });
});

describe('top-level routes', () => {
  it('lists every static folder in app/', () => {
    const app = new URL('../app/', import.meta.url);
    const folders = readdirSync(app, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !/^[[(@_]/.test(d.name))
      .map((d) => d.name);
    expect([...TOP_LEVEL_ROUTES].sort()).toEqual(folders.sort());
  });
});

type SeedOrg = { id: string; slugAliases: string[] };
const seed = JSON.parse(readFileSync(new URL('../../../data/seed/system_cards.json', import.meta.url), 'utf8')) as {
  organizations: SeedOrg[];
  models: { id: string; organizationId: string }[];
};

describe('seed organization slugs', () => {
  const all = seed.organizations.flatMap((o) => [o.id, ...o.slugAliases]);

  it('are unique across slugs and aliases, lowercase, and never a route or reserved word', () => {
    expect(all.filter((s, i) => all.indexOf(s) !== i)).toEqual([]);
    for (const s of all) {
      expect(slugKey(s), s).toBe(s);
      expect(TOP_LEVEL_ROUTES.has(s), s).toBe(false);
      expect(RESERVED_HANDLES.has(s), s).toBe(false);
    }
  });

  it('cover the owner of every model, so /<owner> reaches its organization', () => {
    const byId = new Map(seed.organizations.map((o) => [o.id, o]));
    for (const m of seed.models) {
      const org = byId.get(m.organizationId);
      const owner = m.id.split('/')[0].toLowerCase();
      expect(org, m.id).toBeDefined();
      expect([org!.id, ...org!.slugAliases], m.id).toContain(owner);
    }
  });
});
