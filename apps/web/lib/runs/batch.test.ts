import { describe, expect, it } from 'vitest';
import { requestKey } from './batch';

describe('requestKey', () => {
  it('is the same for the same run, whatever the slot order or empty slots', () => {
    expect(requestKey({ modelId: 'm', evalId: 'e', reasoning: 'none', models: { b: '2', a: '1', c: '' } })).toBe(
      requestKey({ modelId: 'm', evalId: 'e', reasoning: 'none', models: { a: '1', b: '2' } }),
    );
    expect(requestKey({ modelId: 'm', evalId: 'e', reasoning: 'none' })).not.toBe(
      requestKey({ modelId: 'm', evalId: 'e', reasoning: 'high' }),
    );
  });
});
