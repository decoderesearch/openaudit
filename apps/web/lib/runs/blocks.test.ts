import { describe, expect, it } from 'vitest';
import { attemptBlock, blockText } from './blocks';

const XAI = String.raw`ModelGenerateError('\nRequest:\n{\n  "model": "x-ai/grok-4.3",\n  "extra_body": {\n    "provider": {\n      "order": [\n        "xAI"\n      ]\n    }\n  }\n}\n\nPermissionDeniedError(\'Error code: 403 - {\\\'error\\\': {\\\'message\\\': \\\'Provider returned error\\\', \\\'code\\\': 403, \\\'metadata\\\': {\\\'raw\\\': \\\'{"code":"permission-denied","error":"I\\\\\\\'m sorry, I can\\\\\\\'t help with that request."}\\\', \\\'provider_name\\\': \\\'xAI\\\'}}}\')')`;
const CUT = `ModelGenerateError('\\nRequest:\\n{\\n  "messages": [{"role": "user", "content": "A long prompt…`;
const XAI_BLOCK = {
  provider: 'xAI',
  kind: 'content' as const,
  code: 'permission-denied',
  message: "I'm sorry, I can't help with that request.",
  model: 'x-ai/grok-4.3',
};

describe('attemptBlock', () => {
  it('reads an xAI refusal', () => {
    expect(attemptBlock(XAI)).toEqual({
      provider: 'xAI',
      kind: 'content',
      code: 'permission-denied',
      message: "I'm sorry, I can't help with that request.",
    });
  });

  it("gives a cut error the run's block when that block has all the errors", () => {
    expect(attemptBlock(CUT, { erroredSamples: 38, blocks: [{ ...XAI_BLOCK, samples: 38 }] })).toEqual({
      provider: 'xAI',
      kind: 'content',
      code: 'permission-denied',
      message: "I'm sorry, I can't help with that request.",
    });
  });

  it('does not guess when the run has other errors or blocks', () => {
    expect(attemptBlock(CUT, { erroredSamples: 40, blocks: [{ ...XAI_BLOCK, samples: 38 }] })).toBeNull();
    expect(
      attemptBlock(CUT, {
        erroredSamples: 2,
        blocks: [
          { ...XAI_BLOCK, samples: 1 },
          { ...XAI_BLOCK, provider: 'Meta', samples: 1 },
        ],
      }),
    ).toBeNull();
  });

  it('is null for an error that is not a block', () => {
    expect(attemptBlock('RuntimeError: timed out')).toBeNull();
    expect(attemptBlock(undefined)).toBeNull();
  });

  it('reads a reply filter and an account block', () => {
    expect(attemptBlock('Gemini blocked the response: OTHER')).toMatchObject({ provider: 'Google', code: 'other' });
    expect(attemptBlock('Error code: 403 user_blocked provider_name: "Meta"')).toMatchObject({
      provider: 'Meta',
      kind: 'account',
      code: 'user_blocked',
    });
  });
});

describe('blockText', () => {
  it('says who refused', () => {
    expect(blockText({ provider: 'xAI', kind: 'content', code: 'permission-denied' })).toBe(
      'xAI refused the request (permission-denied)',
    );
    expect(blockText({ provider: 'unknown', kind: 'account' })).toBe('The provider blocked our account');
  });
});
