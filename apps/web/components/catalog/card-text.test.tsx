import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardText, parseLinks } from './card-text';

describe('parseLinks', () => {
  it('splits text and links', () => {
    expect(parseLinks('[BBQ](/evals/bbq) accuracy 89.7% (higher is better)')).toEqual([
      { label: 'BBQ', url: '/evals/bbq' },
      ' accuracy 89.7% (higher is better)',
    ]);
    expect(parseLinks('no links')).toEqual(['no links']);
  });
});

describe('CardText', () => {
  const run = { anchor: 'anthropic/claude-opus-5.5@card', slugs: ['bbq'] };

  it('points an eval link at the run when the eval has results for it', () => {
    render(<CardText text="[BBQ](/evals/bbq) and [MMLU](/evaluations/mmlu)" run={run} />);
    expect(screen.getByRole('link', { name: 'BBQ' }).getAttribute('href')).toBe(
      '/evaluations/bbq#anthropic/claude-opus-5.5@card',
    );
    expect(screen.getByRole('link', { name: 'MMLU' }).getAttribute('href')).toBe('/evaluations/mmlu');
  });

  it('opens external links in a new tab', () => {
    render(<CardText text="[HarmBench](https://www.harmbench.org) score" />);
    const a = screen.getByRole('link', { name: 'HarmBench' });
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toContain('nofollow');
  });
});
