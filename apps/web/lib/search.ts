// Site search: the query rules, shared by the navbar and the API route.

export const SEARCH_MAX_CHARS = 80;
export const SEARCH_MAX_TOKENS = 8;
export const SEARCH_LIMIT = 5;

// Spaces and ASCII punctuation. The SQL side removes the same set ([:space:] and [:punct:]).
const SEPARATORS = /[\s!-/:-@[-`{-~]+/;

/**
 * The query as lowercase tokens. A row matches when each token is in its text with the
 * separators removed, so "qwen 27b" matches "Qwen3.6-27B" and "qwen-27b".
 * A run of 2 or more letters before a digit is its own token: "qwen27b" is "qwen" "27b",
 * but "o3" stays "o3".
 */
export function searchTokens(query: string): string[] {
  const parts = query.slice(0, SEARCH_MAX_CHARS).toLowerCase().split(SEPARATORS);
  const tokens = parts.flatMap((p) => p.split(/(?<=\p{L}{2})(?=\p{N})/u)).filter(Boolean);
  return [...new Set(tokens)].slice(0, SEARCH_MAX_TOKENS);
}

/** The text with the separators removed, lowercase. */
export function squash(text: string): string {
  return text.toLowerCase().replace(new RegExp(SEPARATORS, 'g'), '');
}

const withoutParens = (s: string) => s.replace(/\s*\([^)]*\)/g, '').trim();

/**
 * The eval's authors for its search title, or undefined when the title already names one.
 * A note in parentheses is dropped ("Google DeepMind (Inspect Evals port)"), except when the
 * rest only repeats the title ("SAEBench authors (Karvonen, Rager, et al.)").
 */
export function evalAuthors(title: string, maintainers: { name: string }[]): string | undefined {
  const t = title.toLowerCase();
  const names = maintainers.map((m) => {
    const short = withoutParens(m.name);
    const note = /\(([^)]*)\)/.exec(m.name)?.[1];
    return note && short.toLowerCase().includes(withoutParens(t)) ? note : short;
  });
  if (!names.length || names.some((n) => t.includes(n.toLowerCase()))) return undefined;
  return names.join(', ');
}

/**
 * The long form of an abbreviated eval title, from its aliases: "BBQ" is "Bias Benchmark for
 * Question Answering". The capital letters of the title must be, in order, word initials or
 * capital letters of the alias. An alias that has the abbreviation in it does not count.
 */
export function evalExpansion(title: string, aliases: string[]): string | undefined {
  const runs = [...title.matchAll(/[A-Z]{2,}/g)].map((m) =>
    /[a-z]/.test(title[m.index + m[0].length] ?? '') ? m[0].slice(0, -1) : m[0],
  );
  const acronym = runs.find((r) => r.length >= 2);
  if (!acronym) return undefined;
  const spells = (alias: string) => {
    const letters = [...alias.matchAll(/(?<![\p{L}\p{N}])\p{L}|\p{Lu}/gu)].map((m) => m[0].toUpperCase());
    let i = 0;
    for (const l of letters) if (l === acronym[i]) i++;
    return i === acronym.length;
  };
  return aliases
    .map(withoutParens)
    .filter((a) => /\s|-/.test(a) && !a.includes(acronym) && spells(a))
    .sort((a, b) => b.length - a.length)[0];
}

/** The title with its authors in parentheses, inside the title's own when it ends with one. */
export function evalTitle(title: string, maintainers: { name: string }[]): string {
  const authors = evalAuthors(title, maintainers);
  if (!authors) return title;
  return title.endsWith(')') ? `${title.slice(0, -1)}, ${authors})` : `${title} (${authors})`;
}

export type SearchHit = {
  kind: 'model' | 'document' | 'eval' | 'organization';
  title: string;
  detail?: string;
  path: string;
  // The publisher's URL: a document with no card page.
  external?: boolean;
};

export type SearchResults = {
  models: SearchHit[];
  documents: SearchHit[];
  evals: SearchHit[];
  organizations: SearchHit[];
};
