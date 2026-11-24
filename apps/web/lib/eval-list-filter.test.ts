import { describe, expect, it } from 'vitest';
import { EVAL_KIND_LINKS, evalListQuery, isDefaultFilter, parseEvalListFilter } from './eval-list-filter';

describe('eval kind', () => {
  it('links Model and Method Evaluations to their pages', () => {
    expect(EVAL_KIND_LINKS.map((l) => [l.label, l.href])).toEqual([
      ['Model Evaluations', '/models'],
      ['Method Evaluations', '/methods'],
    ]);
  });
});

describe('eval list filter', () => {
  it('shows the evals with results when the URL has no show', () => {
    expect(parseEvalListFilter({})).toEqual({});
    expect(parseEvalListFilter({ subject: 'model', access: 'all', show: 'some' })).toEqual({});
    expect(isDefaultFilter(parseEvalListFilter({}))).toBe(true);
  });

  it('shows all evals with show=all', () => {
    expect(parseEvalListFilter({ show: 'all' })).toEqual({ show: 'all' });
    expect(evalListQuery({ show: 'all' })).toBe('?show=all');
  });

  it('gives back the filter from its query', () => {
    for (const f of [{}, { show: 'all' as const }, { q: 'mask' }, { show: 'all' as const, q: 'deception' }]) {
      const query = Object.fromEntries(new URLSearchParams(evalListQuery(f)));
      expect(parseEvalListFilter(query)).toEqual(f);
    }
  });
});
