/** Lower case, with only letters and digits: "Llama-3.3 70B" is "llama3370b". */
const compact = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** True when `query` is in one of `texts`, in any letter case. Spaces, dashes, dots and other marks
 * do not count: "llama-3.3-70b" and "llama 3.3 70b" both find "Llama 3.3 70B". */
export function searchMatch(texts: string[], query: string) {
  const q = compact(query);
  return texts.some((t) => compact(t).includes(q));
}

/** The models that `query` finds in their name, org or URL (the URL has the org, then the name). */
export function searchModels<T extends { label: string; href: string; org?: { label: string } }>(
  models: T[],
  query: string,
) {
  return query.trim() ? models.filter((m) => searchMatch([m.label, m.org?.label ?? '', m.href], query)) : models;
}
