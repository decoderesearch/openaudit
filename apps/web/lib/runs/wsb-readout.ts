import type { Transcript } from '@openaudit/spec';

/** One note of the summarizer that digests a lens's readouts for the judge: what it found, how much
 * of the readout shows it, and one readout line as evidence. */
export type WsbStatement = { text: string; support?: string; evidence?: string };

/** The judge's verdict on one lens's readout of a question. `pass`: null when the question has no
 * score of its own. `pick`: the option or claim that the judge took from the readout. `units`: the
 * regex families' hit on each part of the answer. `why`: why the pick passes or fails, from the
 * harness's checks. `statements`: the summarizer's notes. `redacted`: the text of the notes and
 * quotes is not kept (the reason, as "nyt"). */
export type WsbVerdict = {
  pass?: boolean | null;
  pick?: string;
  quote?: string;
  units?: Record<string, boolean>;
  why?: string;
  note?: string;
  statements?: WsbStatement[];
  redacted?: string;
};

/** One lens's readout of a question: `cells[layer][position]` is the top tokens of a token lens, or
 * the text samples of a text lens. Null when the lens did not read that cell. */
export type WsbLens = {
  kind: 'tokens' | 'text';
  layers: number[];
  positions: { pos: number; token: string }[];
  cells: (string[] | null)[][];
  verdict: WsbVerdict;
};

/** A model that the harness uses: its id, and the name to show. */
export type WsbModel = { model: string; name: string };

/** The family's settings. `route`: how the judge runs ("Batch API"). `metric`: the family's metric
 * ("pass_rate" or "pair_rate"). `readouts`: by score key, who made that lens's readouts. */
export type WsbSettings = {
  judge?: WsbModel;
  summarizer?: WsbModel;
  route?: string;
  metric?: string;
  readouts?: Record<string, { by: string; url?: string }>;
};

/** A WorkspaceBench question's readouts (`workspacebench-logs.py`). `regex`: the family has no
 * judge. `options`: the judge's choices, when the family has them. `gold`: the right option or
 * claim. `aliases`: the other forms of the gold that the judge accepts. `units`: the forms that
 * each part of the answer accepts. `lenses`: by score key. `redacted`: the question, its options and
 * the readouts are not shown, only each lens's result (the reason, as "nocot"). */
export type WsbReadout = {
  family: string;
  redacted?: string;
  regex?: boolean;
  options?: string[];
  gold?: string;
  aliases?: string[];
  units?: Record<string, string[]>;
  lenses: Record<string, WsbLens>;
};

/** The facts about the sample that the readout view shows. */
export type WsbFacts = { scored?: boolean; notScored?: string };

/** The metadata keys that the readout view shows, so the other metadata leaves them out. */
export const WSB_KEYS = ['wsbReadout', 'scored', 'notScored'];

const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const isCell = (v: unknown) => v === null || (Array.isArray(v) && v.every((x) => typeof x === 'string'));

function isLens(v: unknown): v is WsbLens {
  const l = v as Partial<WsbLens> | null;
  if (!l || (l.kind !== 'tokens' && l.kind !== 'text') || !isNumbers(l.layers) || !Array.isArray(l.positions)) {
    return false;
  }
  const n = l.positions.length;
  return (
    l.positions.every((p) => typeof p?.pos === 'number' && typeof p.token === 'string') &&
    Array.isArray(l.cells) &&
    l.cells.length === l.layers.length &&
    l.cells.every((row) => Array.isArray(row) && row.length === n && row.every(isCell)) &&
    !!l.verdict &&
    typeof l.verdict === 'object'
  );
}

/** The transcript's readouts and facts, or null when it has none or their shape is wrong. */
export function wsbReadoutOf(transcript?: Transcript | null): { readout: WsbReadout; facts: WsbFacts } | null {
  const { inspect } = (transcript?.extensions ?? {}) as { inspect?: { metadata?: Record<string, unknown> } };
  const meta = inspect?.metadata;
  const r = meta?.wsbReadout as Partial<WsbReadout> | undefined;
  if (!r || typeof r.family !== 'string') return null;
  const lenses = Object.entries(r.lenses ?? {}).filter(([, v]) => isLens(v));
  if (!lenses.length) return null;
  return {
    readout: { ...(r as WsbReadout), lenses: Object.fromEntries(lenses) },
    facts: meta as WsbFacts,
  };
}

/** The answers that a cell can name: the gold and its aliases, or else the forms of the regex units. */
export const answersOf = (r: Pick<WsbReadout, 'gold' | 'aliases' | 'units'>): string[] =>
  r.gold ? [r.gold, ...(r.aliases ?? [])] : Object.values(r.units ?? {}).flat();

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;

/** Text with no accents, case or curly quotes, as the harness compares it (`mc.fold`). */
const fold = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** True when `text` has `form`, as the harness finds it (`mc.form_in`): a CJK form anywhere, any
 * other form between word boundaries. */
export function formIn(text: string, form: string): boolean {
  const f = fold(form).trim();
  if (!f) return false;
  const t = fold(text);
  if (CJK.test(f)) return t.includes(f);
  const at = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${at}(?![\\p{L}\\p{N}_])`, 'u').test(t);
}

/** True when a cell names one of the answers: a top token has a form (or one word of a form of more
 * than one word), or a text sample has a form. */
export function namesGold(cell: string[] | null, kind: WsbLens['kind'], answers: string[]): boolean {
  if (!cell || !answers.length) return false;
  if (kind === 'text') return cell.some((s) => answers.some((a) => formIn(s, a)));
  const forms = answers.flatMap((a) => {
    const words = a.trim().split(/\s+/);
    return words.length > 1 ? words.filter((w) => w.length > 1) : words;
  });
  return cell.some((t) => forms.some((f) => formIn(t, f)));
}

/** True when a cell holds the judge's quote: a top token or a text sample has it, or each part of a
 * quote of more than one token ("May | birth") is a top token. */
export function holdsQuote(cell: string[] | null, kind: WsbLens['kind'], quote?: string): boolean {
  if (!cell || !quote?.trim()) return false;
  if (kind === 'text') return cell.some((s) => formIn(s, quote));
  return formIn(cell.join(' | '), quote) || quoteParts(quote).every((p) => cell.some((t) => formIn(t, p)));
}

/** A word that top tokens of adjacent positions at one layer spell, one token of each cell.
 * `parts`: each token and its cell, as `[layer index, position index]`. */
export type SplitWord = { word: string; parts: { at: [number, number]; token: string }[] };

const bare = (s: string) => fold(s).replace(/\s/g, '');

/**
 * The forms in `forms` that a token lens spells across 2 to 4 adjacent positions of one layer, as
 * the harness joins them (`digest.split_word`). A form in one token, or with a space, is not one.
 * One match for each form, layer and first position.
 */
export function splitWords(lens: WsbLens, forms: string[]): SplitWord[] {
  if (lens.kind !== 'tokens') return [];
  const { cells, positions } = lens;
  const walk = (i: number, j: number, rest: string, depth: number): SplitWord['parts'] | null => {
    for (const token of cells[i]?.[j] ?? []) {
      const t = bare(token);
      if (!t || !rest.startsWith(t)) continue;
      if (t === rest) {
        if (depth >= 2) return [{ at: [i, j], token }];
        continue;
      }
      if (depth >= 4 || positions[j + 1]?.pos !== positions[j]!.pos + 1) continue;
      const tail = walk(i, j + 1, rest.slice(t.length), depth + 1);
      if (tail) return [{ at: [i, j], token }, ...tail];
    }
    return null;
  };
  const out: SplitWord[] = [];
  for (const word of new Set(forms.map((f) => f.trim()).filter((f) => f && !/\s/.test(f)))) {
    const want = bare(word);
    cells.forEach((row, i) =>
      row.forEach((_, j) => {
        const parts = walk(i, j, want, 1);
        if (parts) out.push({ word, parts });
      }),
    );
  }
  return out;
}

/** The parts of a quote, split at the "|" between top tokens. */
export const quoteParts = (quote: string) =>
  quote
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);

/** The cells that hold the judge's quote, as `[layer index, position index]`: where its evidence is. */
export function quoteCells(lens: WsbLens): [number, number][] {
  const out: [number, number][] = [];
  lens.cells.forEach((row, i) =>
    row.forEach((cell, j) => {
      if (holdsQuote(cell, lens.kind, lens.verdict.quote)) out.push([i, j]);
    }),
  );
  return out;
}
