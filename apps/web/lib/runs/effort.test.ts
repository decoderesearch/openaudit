import { describe, expect, it } from 'vitest';
import { effortChoice, effortOf } from './effort';

describe('effortChoice', () => {
  it('a model with levels that can turn thinking off (Kimi K3)', () => {
    const r = { supported_efforts: ['max', 'high', 'low'], default_effort: 'max', default_enabled: true };
    expect(effortChoice({ ...r, mandatory: false })).toEqual({
      options: ['none', 'low', 'high', 'max'],
      default: 'max',
    });
  });

  it('thinking that cannot be turned off has no none (Claude Opus 5.5)', () => {
    const r = { mandatory: true, supported_efforts: ['max', 'xhigh', 'high', 'medium', 'low'], default_effort: 'high' };
    expect(effortChoice(r)).toEqual({ options: ['low', 'medium', 'high', 'xhigh', 'max'], default: 'high' });
  });

  it('thinking off by default (Claude Opus 4.8)', () => {
    const r = { mandatory: false, default_enabled: false, supported_efforts: ['high', 'low'], default_effort: 'high' };
    expect(effortChoice(r)).toEqual({ options: ['none', 'low', 'high'], default: 'none' });
  });

  it('on or off only (Qwen 3.6 27B)', () => {
    expect(effortChoice({ mandatory: false, default_enabled: true })).toEqual({
      options: ['none', 'on'],
      default: 'on',
    });
    expect(effortChoice({ mandatory: false })).toEqual({ options: ['none', 'on'], default: 'none' });
  });

  it('a model that does not think, and a model with no data', () => {
    expect(effortChoice(null)).toEqual({ options: ['none'], default: 'none' });
    expect(effortChoice(undefined)).toEqual({ options: ['none', 'on'], default: 'none' });
  });

  it('leaves out levels it does not know', () => {
    expect(effortChoice({ supported_efforts: ['ultra', 'low'], default_effort: 'ultra' }).options).toEqual([
      'none',
      'low',
    ]);
  });
});

describe('effortOf', () => {
  it('reads old runs that say off as none, and unset as null', () => {
    expect(effortOf({ reasoning: 'off' })).toBe('none');
    expect(effortOf({ reasoning: 'high' })).toBe('high');
    expect(effortOf({})).toBeNull();
    expect(effortOf({ reasoning: 'ultra' })).toBeNull();
  });
});
