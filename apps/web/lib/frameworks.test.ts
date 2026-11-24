import type { RiskDecision } from '@openaudit/spec';
import { describe, expect, it } from 'vitest';
import { frameworksUsed } from './frameworks';

const verdict = (frameworks?: RiskDecision['frameworks']) =>
  ({ domain: 'cyber', labLabel: 'x', phase: 'unspecified', source: { quote: 'x' }, frameworks }) as RiskDecision;

describe('frameworksUsed', () => {
  it('lists each framework once, in the order first named', () => {
    expect(
      frameworksUsed([verdict(['anthropic-rsp', 'anthropic-fcf']), verdict(), verdict(['anthropic-fcf'])]),
    ).toEqual(['anthropic-rsp', 'anthropic-fcf']);
  });

  it('is empty when no verdict names a framework', () => {
    expect(frameworksUsed([verdict()])).toEqual([]);
  });
});
