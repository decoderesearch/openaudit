// Shared by the extraction scripts: the quote match and every cited source in an extraction.

/** Text for quote matching: no case, spaces, punctuation or zero-width marks, so PDF layout does not matter. */
export const squash = (s) =>
  s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{P}\p{S}\p{Z}\p{Cf}\s]+/gu, '');

/** Each `{ where, source }` in an extraction file that has a quote. */
export function* sources(data) {
  const all = [
    ...Object.entries(data.disclosures ?? {}).map(([k, v]) => [`/disclosures/${k}`, v.source]),
    ...(data.riskDecisions ?? []).map((r, i) => [`/riskDecisions/${i}`, r.source]),
    ...(data.topics ?? []).map((t, i) => [`/topics/${i} (${t.topic})`, t.source]),
    ...(data.testers ?? []).map((t, i) => [`/testers/${i}`, t.source]),
    ...(data.findings ?? []).map((f, i) => [`/findings/${i}`, f.source]),
    ...(data.evalResults ?? []).map((r, i) => [`/evalResults/${i} (${r.rawEvalName})`, r.source]),
  ];
  for (const [where, source] of all) if (source?.quote) yield { where, source };
}
