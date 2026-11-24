import { searchMatch, searchModels } from '@/lib/search-match';
import { describe, expect, it } from 'vitest';

describe('searchMatch', () => {
  it('finds a name in any letter case, with or without its marks', () => {
    expect(searchMatch(['Llama 3.3 70B IT'], 'llama-3.3-70b-it')).toBe(true);
    expect(searchMatch(['Llama-3.3-70B-it'], 'llama 3.3 70b it')).toBe(true);
    expect(searchMatch(['/nvidia/Llama-3_3-Nemotron-Super-49B-v1_5'], 'llama 3.3 nemotron')).toBe(true);
    expect(searchMatch(['GPT-6 Luna'], 'gpt6')).toBe(true);
  });

  it('keeps the order of the query', () => {
    expect(searchMatch(['GPT-5.6 Luna'], 'GPT 6')).toBe(false);
    expect(searchMatch(['GPT-6 Luna'], 'luna gpt')).toBe(false);
  });

  it('finds all with an empty query', () => {
    expect(searchMatch(['Anything'], '')).toBe(true);
    expect(searchMatch(['Anything'], '  - ')).toBe(true);
  });
});

describe('searchModels', () => {
  const models = [
    { label: 'GPT-6 Luna', href: '/openai/gpt-6-luna', org: { label: 'OpenAI' } },
    { label: 'GPT-5.6 Luna', href: '/openai/gpt-5.6-luna', org: { label: 'OpenAI' } },
    { label: 'Gemma 4 31B', href: '/google/gemma-4-31b', org: { label: 'Google' } },
  ];
  const labels = (q: string) => searchModels(models, q).map((m) => m.label);

  it('finds by name, org, or org then name', () => {
    expect(labels('gpt 6')).toEqual(['GPT-6 Luna']);
    expect(labels('google')).toEqual(['Gemma 4 31B']);
    expect(labels('openai gpt-5.6')).toEqual(['GPT-5.6 Luna']);
  });

  it('gives all models for a blank query', () => {
    expect(searchModels(models, ' ')).toBe(models);
  });
});
