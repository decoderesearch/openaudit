import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPlaceholderModel, modelPathOf, OWNER_ROUTES, TOP_ROUTES } from './model-links';

/** The fixed-name routes in `app/<dir>`, with those in its route groups ("(org)"). */
const routes = (dir: string): string[] =>
  readdirSync(join(__dirname, '..', 'app', dir), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !/^[[@_.]/.test(d.name))
    .flatMap((d) => (d.name.startsWith('(') ? routes(join(dir, d.name)) : [d.name]))
    .sort();

describe('modelPathOf', () => {
  it('finds model pages, with a query or anchor', () => {
    expect(modelPathOf('/openai/gpt-oss-20b')).toBe('/openai/gpt-oss-20b');
    expect(modelPathOf('/Qwen/Qwen3-8B#deploymeter')).toBe('/qwen/qwen3-8b');
    expect(modelPathOf('/google/gemma%203?x=1')).toBe('/google/gemma 3');
  });

  it('leaves out other pages', () => {
    for (const href of [
      '/openai',
      '/evaluations/mask',
      '/runs/abc',
      '/openai/incidents',
      '/openai/departures',
      '/openai/models',
      '/openai/x/cards',
      'https://x.com/a/b',
    ])
      expect(modelPathOf(href)).toBeNull();
  });

  it('knows a placeholder for a model with no public name', () => {
    expect(isPlaceholderModel('openai/unreleased-hf-hack')).toBe(true);
    expect(isPlaceholderModel('openai/unknown-medicare-agent')).toBe(true);
    expect(isPlaceholderModel('openai/gpt-oss-20b')).toBe(false);
    expect(isPlaceholderModel('acme/model-unreleased-v2')).toBe(false);
  });

  it('knows every route of app/ with a fixed name', () => {
    expect([...TOP_ROUTES].sort()).toEqual(routes('.'));
    expect([...OWNER_ROUTES].sort()).toEqual(routes('[owner]'));
  });
});
