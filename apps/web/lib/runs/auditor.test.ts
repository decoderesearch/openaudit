import type { ModelSlot } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { OTHER_AUDITORS, auditorProblem, checkAuditors } from './auditor';

const SLOTS: ModelSlot[] = [
  { id: 'auditor', role: 'auditor', inspectRole: 'auditor', default: 'anthropic/claude-sonnet-4.6' },
  { id: 'judge', role: 'judge', inspectRole: 'judge', default: 'anthropic/claude-sonnet-5.5', scoring: true },
];
const models = (auditor: string) => ({ auditor, judge: 'anthropic/claude-sonnet-5.5' });

describe('auditor rule', () => {
  it('never lets the target audit itself', () => {
    expect(auditorProblem('openai/gpt-6-luna', 'openrouter/openai/gpt-6-luna')).toMatch(/is the target/);
    expect(checkAuditors(SLOTS, models('openai/gpt-6-luna'), 'openai/gpt-6-luna', {})).toEqual(
      models(OTHER_AUDITORS[1]),
    );
    expect(checkAuditors(SLOTS, models('openai/gpt-6-luna'), 'qwen/qwen3.6-27b', {})).toEqual(
      models('openai/gpt-6-luna'),
    );
  });

  it('gives a Claude target an auditor from another family', () => {
    const out = checkAuditors(SLOTS, models('anthropic/claude-sonnet-4.6'), 'anthropic/claude-opus-5.5', {});
    expect(typeof out === 'object' && out.auditor.startsWith('anthropic/')).toBe(false);
    expect(typeof out === 'object' && out.judge).toBe('anthropic/claude-sonnet-5.5');
  });

  it('refuses a chosen auditor that breaks the rule', () => {
    const chosen = { auditor: 'anthropic/claude-haiku-4.5' };
    expect(checkAuditors(SLOTS, models(chosen.auditor), 'anthropic/claude-sonnet-5.5', chosen)).toMatch(/Claude/);
  });
});
