import { isSystemCardPath, modelMode, modelModePath } from '@/lib/model-mode';
import { describe, expect, it } from 'vitest';

describe('model page modes', () => {
  it('reads the mode from ?tab=, with openaudit as the default', () => {
    expect(modelMode('system-card')).toBe('system-card');
    expect(modelMode('openaudit')).toBe('openaudit');
    expect(modelMode(undefined)).toBe('openaudit');
    expect(modelMode('both')).toBe('openaudit');
    expect(modelMode(['system-card'])).toBe('openaudit');
  });

  it('makes and finds the mode paths', () => {
    expect(modelModePath('/openai/gpt-6-luna', 'openaudit')).toBe('/openai/gpt-6-luna');
    expect(modelModePath('/openai/gpt-6-luna', 'system-card')).toBe('/openai/gpt-6-luna?tab=system-card');
    expect(isSystemCardPath('/openai/gpt-6-luna?tab=system-card')).toBe(true);
    expect(isSystemCardPath('/openai/gpt-6-luna?v=2&tab=system-card')).toBe(true);
    expect(isSystemCardPath('/openai/gpt-6-luna?tab=system-cards')).toBe(false);
    expect(isSystemCardPath('/openai/gpt-6-luna')).toBe(false);
  });
});
