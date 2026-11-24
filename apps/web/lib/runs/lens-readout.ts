import type { Transcript } from '@openaudit/spec';

/** One lens's readout of a sample: its top tokens at each layer, and each hidden token's rank at
 * each layer (1 is the top). `file`: the lens file. */
export type LensRead = { file?: string; top: string[][]; ranks: Record<string, number[]> };

/** A workspace lens readout of one sample (`workspace-lens-readout-logs.py`). `layers`: the layers
 * of `top` and `ranks`, in order. `readoutLayers`: the layers that the score uses. `k`: a hidden
 * token is found when its rank is `k` or better at one of those layers. */
export type LensReadout = {
  layers: number[];
  readoutLayers: number[];
  k: number;
  readoutFilter?: boolean;
  lenses: Record<string, LensRead>;
};

/** The facts about the sample that the readout view shows, from the same metadata. */
export type ReadoutFacts = {
  readoutToken?: string;
  modelTop?: [string, number][];
  modelCorrect?: boolean | null;
  answer?: string | null;
  scored?: boolean;
  notScored?: string;
  droppedTokens?: string[];
};

/** The metadata keys that the readout view shows, so the other metadata leaves them out. */
export const READOUT_KEYS = [
  'lensReadout',
  'readoutToken',
  'modelTop',
  'modelCorrect',
  'answer',
  'scored',
  'notScored',
  'droppedTokens',
];

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');

function isRead(v: unknown, n: number): v is LensRead {
  if (!v || typeof v !== 'object') return false;
  const { top, ranks } = v as Partial<LensRead>;
  return (
    Array.isArray(top) &&
    top.length === n &&
    top.every((t) => Array.isArray(t) && t.every((x) => typeof x === 'string')) &&
    !!ranks &&
    typeof ranks === 'object' &&
    Object.values(ranks).every((r) => isNumbers(r) && r.length === n)
  );
}

/** The transcript's readout and facts, or null when it has no readout or its shape is wrong. */
export function lensReadoutOf(transcript?: Transcript | null): { readout: LensReadout; facts: ReadoutFacts } | null {
  const { inspect } = (transcript?.extensions ?? {}) as { inspect?: { metadata?: Record<string, unknown> } };
  const meta = inspect?.metadata;
  const r = meta?.lensReadout as Partial<LensReadout> | undefined;
  if (!r || !isNumbers(r.layers) || !isNumbers(r.readoutLayers) || typeof r.k !== 'number') return null;
  const n = r.layers.length;
  const lenses = Object.entries(r.lenses ?? {}).filter(([, v]) => isRead(v, n));
  if (!lenses.length) return null;
  return {
    readout: { ...(r as LensReadout), lenses: Object.fromEntries(lenses) },
    facts: meta as ReadoutFacts,
  };
}

/** True when a readout token is the hidden token, with no spaces and in any case. */
export const isHidden = (token: string, hidden: string) => token.trim().toLowerCase() === hidden.trim().toLowerCase();

/** A token as short text: its outer spaces shown as `·`, a new line as `↵`, and an empty token as `∅`. */
export function tokenText(token: string): string {
  if (!token) return '∅';
  return token.replace(/\n/g, '↵').replace(/^ +| +$/g, (s) => '·'.repeat(s.length));
}

/** The best rank of each hidden token over the readout layers, and the layer of the first best. */
export function bestRanks(read: LensRead, layers: number[], readoutLayers: number[]) {
  const at = readoutLayers.map((l) => layers.indexOf(l)).filter((i) => i >= 0);
  return Object.fromEntries(
    Object.entries(read.ranks).map(([token, ranks]) => {
      const i = at.reduce((b, x) => (ranks[x]! < ranks[b]! ? x : b), at[0] ?? 0);
      return [token, { rank: ranks[i]!, layer: layers[i]! }];
    }),
  );
}
