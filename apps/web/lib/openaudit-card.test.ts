import { describe, expect, it } from 'vitest';
import { evaluationsPage } from './openaudit-card';

describe('evaluationsPage', () => {
  it('links to the Evaluations section', () => {
    expect(evaluationsPage('/qwen/qwen3')).toBe('/qwen/qwen3#evaluations');
  });

  it("opens the chat's attempt in the side panel", () => {
    expect(evaluationsPage('/qwen/qwen3', { id: 's1', href: '/runs/r1/attempts/7' })).toBe(
      '/qwen/qwen3?run=r1&attempt=7&snippet=s1#evaluations',
    );
  });

  it('has no panel for a chat with no attempt page', () => {
    expect(evaluationsPage('/qwen/qwen3', { id: 's1', href: '/elsewhere' })).toBe('/qwen/qwen3#evaluations');
  });
});
