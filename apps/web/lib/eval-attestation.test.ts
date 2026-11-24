import {
  attestationHeaders,
  NO_TRAINING_PROMISE,
  readAttestation,
  withAttestation,
  type Attestation,
} from '@/lib/eval-attestation';
import { describe, expect, it } from 'vitest';

const URL_ = 'https://openaudit.test/api/snippets/x';
const req = (headers: Record<string, string> = {}, url = URL_) => new Request(url, { headers });

describe('readAttestation', () => {
  it('accepts a person and an AI agent with the exact promise', () => {
    const human: Attestation = { client: 'human' };
    const ai: Attestation = { client: 'ai', agent: 'Claude Code (claude-opus-5) for Example Lab' };
    expect(readAttestation(req(attestationHeaders(human)))).toEqual({ ok: true, value: human });
    expect(readAttestation(req(attestationHeaders(ai)))).toEqual({ ok: true, value: ai });
  });

  it('reads the query parameters of a download link', () => {
    const ai: Attestation = { client: 'ai', agent: 'Agent X' };
    expect(readAttestation(req({}, withAttestation(URL_, ai)))).toEqual({ ok: true, value: ai });
  });

  it.each([
    ['no headers', {}],
    ['an unknown client', { 'x-openaudit-client': 'bot', 'x-openaudit-no-training': NO_TRAINING_PROMISE }],
    ['an AI agent with no name', { 'x-openaudit-client': 'ai', 'x-openaudit-no-training': NO_TRAINING_PROMISE }],
    ['a changed promise', { 'x-openaudit-client': 'human', 'x-openaudit-no-training': 'true' }],
    [
      'a name that is too long',
      {
        'x-openaudit-client': 'ai',
        'x-openaudit-ai-agent': 'a'.repeat(201),
        'x-openaudit-no-training': NO_TRAINING_PROMISE,
      },
    ],
  ])('refuses %s', (_, headers) => {
    expect(readAttestation(req(headers)).ok).toBe(false);
  });
});
