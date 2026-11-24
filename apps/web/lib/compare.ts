// The compare page's URL and its "best" marks. Safe in server and client code.

/** The most models that the compare page shows side by side. */
export const COMPARE_MAX = 5;

export const COMPARE_PATH = '/models/compare';

/** The model names in `id1`, `id2`, ... in that order, with no empty or repeated names. */
export function compareParams(params: Record<string, unknown>): string[] {
  const names: string[] = [];
  for (let i = 1; i <= COMPARE_MAX; i++) {
    const v = params[`id${i}`];
    const name = typeof v === 'string' ? v.trim() : '';
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** The compare page for these model names: `id1` is the first. A `/` in a name stays as it is, so
 * that the URL is easy to read. */
export function compareHref(names: string[]) {
  const s = names
    .slice(0, COMPARE_MAX)
    .map((n, i) => `id${i + 1}=${encodeURIComponent(n).replaceAll('%2F', '/')}`)
    .join('&');
  return s ? `${COMPARE_PATH}?${s}` : COMPARE_PATH;
}

/** A model's name from its page's path: `/NousResearch/Arete-27B` is `NousResearch/Arete-27B`. */
export const modelNameOf = (href: string) => href.slice(1).split('/').map(decodeURIComponent).join('/');

/** The compare page for the 2 models with the newest OpenAudit cards. */
export function compareLatestHref(cards: { href: string; date: string }[]) {
  const newest = cards.toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 2);
  return compareHref(newest.map((c) => modelNameOf(c.href)));
}

/** For each value, true when it is the best: the lowest (`min`) or the highest (`max`). No value is
 * best when fewer than 2 values are known, or when all known values are the same. */
export function bestOf(values: (number | null | undefined)[], better: 'min' | 'max'): boolean[] {
  const known = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (known.length < 2 || known.every((v) => v === known[0])) return values.map(() => false);
  const best = better === 'min' ? Math.min(...known) : Math.max(...known);
  return values.map((v) => v === best);
}
