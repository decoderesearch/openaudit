import type { Transcript } from '@openaudit/spec';

/** One trial of one lens at one scale: the swap answer's word rank after the edit (1 is the top),
 * the first answer's rank, the top words, and the edit's size as a share of the residual. `to`: the
 * unrelated word of a random swap. */
export type SwapTrial = {
  scale: number;
  rank: number;
  answerRank: number;
  top: string[];
  editNorm: number;
  to?: string;
};

/** The trial kinds: the swap of the hidden step, and the two controls. */
export const SWAP_VARIANTS = ['main', 'answerSwap', 'randomNull'] as const;
export type SwapVariant = (typeof SWAP_VARIANTS)[number];

/** A probe swap of one sample (`workspace-probe-swap-logs.py`). `bestScale`: the scale of each
 * lens's score. `cleanTop`: the model's top words with no edit. `trials`: by kind, then lens key. */
export type ProbeSwap = {
  layers: number[];
  scales: number[];
  bestScale: Record<string, number>;
  intermediate: string;
  swapTo: string;
  answer: string;
  swapAnswer: string;
  cleanTop?: string[];
  cleanAnswerRank?: number;
  cleanSwapRank?: number;
  trials: Partial<Record<SwapVariant, Record<string, SwapTrial[]>>>;
};

/** The facts about the sample that the swap view shows. */
export type SwapFacts = { scored?: boolean; notScored?: string };

/** The metadata keys that the swap view shows, so the other metadata leaves them out. */
export const SWAP_KEYS = ['probeSwap', 'scored', 'notScored'];

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const isTrial = (v: unknown): v is SwapTrial => {
  const t = v as Partial<SwapTrial> | null;
  return !!t && typeof t.scale === 'number' && typeof t.rank === 'number' && Array.isArray(t.top);
};

/** The transcript's probe swap and facts, or null when it has none or its shape is wrong. */
export function probeSwapOf(transcript?: Transcript | null): { swap: ProbeSwap; facts: SwapFacts } | null {
  const { inspect } = (transcript?.extensions ?? {}) as { inspect?: { metadata?: Record<string, unknown> } };
  const meta = inspect?.metadata;
  const s = meta?.probeSwap as Partial<ProbeSwap> | undefined;
  if (!s || !isNumbers(s.layers) || !isNumbers(s.scales) || typeof s.swapAnswer !== 'string') return null;
  const trials = Object.fromEntries(
    SWAP_VARIANTS.flatMap((v) => {
      const byLens = Object.entries(s.trials?.[v] ?? {}).filter(([, t]) => Array.isArray(t) && t.every(isTrial));
      return byLens.length ? [[v, Object.fromEntries(byLens)]] : [];
    }),
  );
  return {
    swap: { ...(s as ProbeSwap), bestScale: s.bestScale ?? {}, trials },
    facts: meta as SwapFacts,
  };
}

/** True when a word is `want`, with no spaces and in any case. */
export const isWord = (word: string, want: string) => word.trim().toLowerCase() === want.trim().toLowerCase();
