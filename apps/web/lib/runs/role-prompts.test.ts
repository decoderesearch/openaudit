import type { ModelSlot } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { promptHeadings, slotPrompts, writtenMessages, type RolePrompt } from './role-prompts';

const persuadee: RolePrompt = {
  role: 'persuadee',
  model: 'openrouter/google/gemini-3.8-flash',
  calls: 3,
  messages: [
    { role: 'system', text: 'Simulate a person.', call: 1 },
    { role: 'system', text: 'Reply to the AI.', call: 2 },
  ],
};
const followup: RolePrompt = {
  role: 'openrouter/openai/gpt-4.1-mini',
  model: 'openrouter/openai/gpt-4.1-mini',
  calls: 1,
  messages: [{ role: 'user', text: 'Write a follow-up question.', call: 1 }],
};
const judge: RolePrompt = {
  role: 'evaluator',
  model: 'openrouter/google/gemini-3.8-flash',
  calls: 3,
  messages: [
    { role: 'system', text: 'You grade.', call: 1 },
    { role: 'user', text: 'Grade this reply.', call: 1 },
  ],
};

const slot = (s: Partial<ModelSlot> & Pick<ModelSlot, 'id' | 'role'>): ModelSlot => ({ default: 'x/y', ...s });

describe('slotPrompts', () => {
  it('finds a slot by its Inspect role, else by its id or model, with the partners first', () => {
    const slots = [
      slot({ id: 'evaluator', role: 'judge', inspectRole: 'evaluator' }),
      slot({ id: 'persuadee', role: 'auditor', inspectRole: 'persuadee' }),
      slot({ id: 'followup', role: 'auditor', taskArg: 'followup_model', default: 'openai/gpt-4.1-mini' }),
      slot({ id: 'judge', role: 'judge', taskArg: 'judge_model', default: 'anthropic/claude-sonnet-5.5' }),
      slot({ id: 'mark', role: 'auditor', inspectRole: 'mark' }),
    ];
    const named = { ...judge, role: 'judge', model: 'openrouter/anthropic/claude-sonnet-5.5' };
    const found = slotPrompts([persuadee, followup, judge, named], slots, (s) => s.default);
    expect(found.map((f) => [f.slot.id, f.prompt.role])).toEqual([
      ['persuadee', 'persuadee'],
      ['followup', 'openrouter/openai/gpt-4.1-mini'],
      ['evaluator', 'evaluator'],
      ['judge', 'judge'],
    ]);
  });
});

describe('writtenMessages', () => {
  it('gives each call its user message, after the sample’s own', () => {
    expect(writtenMessages([1, 3, 5], 3)).toEqual([1, 3, 5]);
    expect(writtenMessages([1, 3], 3)).toEqual([1, 3]);
    expect(writtenMessages([0, 2, 4], 2)).toEqual([2, 4]);
  });
});

describe('promptHeadings', () => {
  it('names the calls that got each prompt', () => {
    expect(promptHeadings('Persuadee', persuadee)).toEqual([
      'Persuadee: System Prompt (Call 1)',
      'Persuadee: System Prompt (Calls 2–3)',
    ]);
    expect(promptHeadings('Evaluator', judge)).toEqual([
      'Evaluator: System Prompt (Calls 1–3)',
      'Evaluator: User Prompt (First Call)',
    ]);
    expect(promptHeadings('Follow-up writer', followup)).toEqual(['Follow-up writer: User Prompt']);
  });
});
