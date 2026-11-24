import { describe, expect, it } from 'vitest';
import { lab, roleModels, tierModels } from './model-ladders';

describe('model ladders', () => {
  it('finds the lab from the prefix and the aliases', () => {
    expect(lab('anthropic/claude-sonnet-5.5')).toBe('anthropic');
    expect(lab('openrouter/meta-llama/llama-3.3-70b-instruct')).toBe('meta');
  });

  it('skips the models of the target lab', () => {
    expect(roleModels('aggregator', 'anthropic/claude-haiku-4.5')[0]).toBe('openai/gpt-6.1-sol');
    expect(roleModels('aggregator', 'Qwen/Qwen3.6-27B')[0]).toBe('anthropic/claude-sonnet-5.5');
    expect(roleModels('flagger')[0]).toBe('openai/gpt-6-luna');
  });

  it('gives nothing for an unknown role or tier', () => {
    expect(roleModels('nobody')).toEqual([]);
    expect(tierModels('nothing')).toEqual([]);
  });
});
