import type { EvalRunner } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { PICKABLE_SLOT_MODELS } from './requests';
import { JUDGES, canRun, otherModelsText, slotAllows, slotRoute } from './routes';

describe('canRun', () => {
  const task: EvalRunner = { kind: 'inspect', task: 'inspect_evals/truthfulqa', roles: ['target'] };

  it('runs an Inspect task with one target model', () => {
    expect(canRun(task)).toBe(true);
    expect(canRun({ kind: 'inspect', task: 'inspect_evals/bbq' })).toBe(true);
  });

  it('runs a judge when a slot fills its role with a model we can reach', () => {
    const judge = { id: 'judge', role: 'judge', taskArg: 'scorer_model', default: 'openai/gpt-4o' } as const;
    const judged: EvalRunner = { ...task, roles: ['target', 'judge'], models: [judge] };
    expect(canRun(judged)).toBe(true);
    expect(canRun({ ...judged, models: [{ ...judge, default: 'anthropic/claude-3.7-sonnet' }] })).toBe(false);
    expect(canRun({ ...judged, models: [{ ...judge, inspectRole: 'grader' }] })).toBe(false);
  });

  it('does not run unfilled roles, sandboxes, GPUs, other runners or no task', () => {
    expect(canRun({ ...task, roles: ['target', 'judge'] })).toBe(false);
    expect(canRun({ ...task, sandbox: 'docker' })).toBe(false);
    expect(canRun({ ...task, gpu: true })).toBe(false);
    expect(canRun({ kind: 'external', task: 'x' })).toBe(false);
    expect(canRun({ kind: 'inspect' })).toBe(false);
    expect(canRun(undefined)).toBe(false);
  });

  it('runs only the package versions the runner has', () => {
    expect(canRun({ ...task, package: 'inspect-petri==3.1.0' })).toBe(true);
    expect(canRun({ ...task, package: 'inspect-petri==3.0.0' })).toBe(false);
    expect(canRun({ ...task, dependencies: ['inspect-petri==3.0.0'] })).toBe(false);
    expect(canRun({ ...task, package: 'not-installed==1.0' })).toBe(false);
  });
});

describe('otherModelsText', () => {
  it('lists slot models in slot order', () => {
    const slots = [
      { id: 'a', role: 'judge', taskArg: 'x', default: 'm' },
      { id: 'b', role: 'judge', taskArg: 'y', default: 'm' },
    ] as const;
    expect(otherModelsText([...slots], { b: slotRoute('q'), a: slotRoute('p') })).toBe('a: p, b: q');
  });
});

describe('slotAllows', () => {
  const slot = { id: 'judge', role: 'judge', taskArg: 'scorer_model', default: 'openai/gpt-4o' } as const;

  it('allows the default and the cheap models, and no other model', () => {
    expect(slotAllows(slot, 'openai/gpt-4o')).toBe(true);
    expect(slotAllows(slot, 'google/gemini-2.5-flash-lite')).toBe(true);
    expect(slotAllows(slot, 'anthropic/claude-sonnet-4.5')).toBe(false);
  });

  it('lists only models that we know for slots', () => {
    expect(PICKABLE_SLOT_MODELS.filter((m) => !JUDGES.includes(m))).toEqual([]);
  });
});
