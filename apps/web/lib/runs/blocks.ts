import type { EvalRun, ProviderBlock } from '@openaudit/spec';

// Provider blocks in an attempt's error, as `blocks.py` in the runner finds them: a provider
// refused the call for its policy. This is not the model's own refusal, and the sample has no score.

export type AttemptBlock = Omit<ProviderBlock, 'samples' | 'model'>;
type RunProvenance = EvalRun['provenance'];

const ACCOUNT = /user_blocked|account_blocked|access has been restricted|account has been suspended/i;
const CODES = ['user_blocked', 'account_blocked', 'data_inspection_failed', 'permission-denied', 'content_filter'];
const PROVIDER = /provider_name[\\'": ]+([A-Za-z0-9][A-Za-z0-9 ._-]*?)[\\'"]/;
const ORDER = /"order": \[\s*"([^"]+)"/;
const MESSAGE = /"(?:message|error)": ?"((?:[^"\\]|\\.){4,300}?)"/g;
const STATUS_403 = /Error(?: code:)? 403/;
const REPLY = /\b(\w+) blocked the response: ([A-Z_]+)/;
const REPLY_PROVIDERS: Record<string, string> = { Gemini: 'Google' };
const GENERIC = new Set(['Provider returned error']);

/** The block that `error` states. Else, when one block has all of the run's errors, that block:
 * a stored error can be cut before its code. Null: not a block. */
export function attemptBlock(error: string | undefined | null, run?: RunProvenance): AttemptBlock | null {
  if (!error) return null;
  const low = error.toLowerCase();
  if (low.includes('biological risk'))
    return {
      provider: 'OpenAI',
      kind: 'content',
      code: 'bio_risk',
      message: 'This content was flagged for possible biological risk.',
    };
  const reply = REPLY.exec(error);
  if (reply)
    return { provider: REPLY_PROVIDERS[reply[1]!] ?? reply[1]!, kind: 'content', code: reply[2]!.toLowerCase() };
  const provider = PROVIDER.exec(error) ?? ORDER.exec(error);
  const policy =
    ACCOUNT.test(error) || low.includes('data_inspection_failed') || (STATUS_403.test(error) && PROVIDER.test(error));
  if (policy) {
    const code = CODES.filter((c) => low.includes(c)).at(-1);
    const message = [...error.matchAll(MESSAGE)]
      .map((m) => m[1]!)
      .filter((m) => !GENERIC.has(m))
      .at(-1);
    return {
      provider: provider?.[1] ?? 'unknown',
      kind: ACCOUNT.test(error) ? 'account' : 'content',
      ...(code && { code }),
      ...(message && { message: message.replace(/\\+'/g, "'").slice(0, 300) }),
    };
  }
  return runBlock(run);
}

/** The run's block when one block has all of its errors, else null. */
export function runBlock(run?: RunProvenance): AttemptBlock | null {
  const [only, ...more] = run?.blocks ?? [];
  if (!only || more.length || only.samples <= 0 || only.samples !== run?.erroredSamples) return null;
  const { samples: _s, model: _m, ...block } = only;
  return block;
}

/** A Postgres regex for the errors that state a block, as `attemptBlock` reads them. With `~*`. */
export const BLOCK_PATTERN =
  'biological risk|blocked the response: |user_blocked|account_blocked|access has been restricted|account has been suspended|data_inspection_failed';
/** With `BLOCK_PATTERN`: a 403 that names its provider is a block too. */
export const BLOCK_403 = ['Error (code: )?403', 'provider_name'] as const;

/** "xAI refused the request (permission-denied)", for a block. */
export function blockText(b: AttemptBlock) {
  const who = b.provider === 'unknown' ? 'The provider' : b.provider;
  const what = b.kind === 'account' ? 'blocked our account' : 'refused the request';
  return `${who} ${what}${b.code ? ` (${b.code})` : ''}`;
}
