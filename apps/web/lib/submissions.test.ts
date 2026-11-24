import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HARNESSES, harnessMethodOf } from './submissions';

const ROOT = join(__dirname, '..', '..', '..');

const harnesses = Object.entries(HARNESSES).flatMap(([slug, hs]) =>
  hs.map((h) => [`${slug} ${h.path}`, slug, h] as const),
);

describe('HARNESSES', () => {
  it.each(harnesses)('%s agrees with its submission/rules.json', (_, slug, h) => {
    const rules = JSON.parse(readFileSync(join(ROOT, h.path, 'submission', 'rules.json'), 'utf8'));
    expect(rules.methods ?? [rules.method]).toContain(slug);
    expect(rules.artifact).toBe(h.artifact.toLowerCase());
    expect(rules.models).toEqual(h.models);
    expect(rules.anyModel !== false).toBe(h.anyModel);
    expect(rules.coreModels).toEqual(h.coreModels);
    expect(!!rules.fit).toBe(!!h.recipe);
    expect(h.evals).toEqual(expect.arrayContaining(Object.keys(rules.evals)));
  });

  it('has each harness of each submission/rules.json', () => {
    const pairs = readdirSync(join(ROOT, 'evals'))
      .filter((dir) => existsSync(join(ROOT, 'evals', dir, 'submission', 'rules.json')))
      .flatMap((dir) => {
        const rules = JSON.parse(readFileSync(join(ROOT, 'evals', dir, 'submission', 'rules.json'), 'utf8'));
        return (rules.methods ?? [rules.method]).map((m: string) => `${m} evals/${dir}`);
      });
    expect(harnesses.map(([name]) => name).sort()).toEqual(pairs.sort());
  });

  it('finds the method of an eval in any of its harnesses', () => {
    expect(harnessMethodOf('workspace-probe-swap')).toBe('workspace-lenses');
    expect(harnessMethodOf('workspacebench')).toBe('workspace-lenses');
    expect(harnessMethodOf('no-such-eval')).toBeUndefined();
  });
});
