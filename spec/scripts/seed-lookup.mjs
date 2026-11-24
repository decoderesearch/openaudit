// Looks things up in data/seed/system_cards.json, for people and agents writing extraction files.
//   node spec/scripts/seed-lookup.mjs card <document key>   the card's documents and its models
//   node spec/scripts/seed-lookup.mjs models <text>         seed models whose id, name or API id has <text>
//   node spec/scripts/seed-lookup.mjs cards                 every card group, one per line
//   node spec/scripts/seed-lookup.mjs evals [text]          registry evals (data/seed/evals), for /evals/<slug> links
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const seed = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../../data/seed/system_cards.json", import.meta.url),
    ),
    "utf8",
  ),
);
const CARD_KINDS = new Set(["system_card", "safety_report", "model_page"]);

/** One card can be a PDF, a web page and a blog post; they share a key without `-pdf`/`-dsh`. */
export function cardGroups() {
  const groups = new Map();
  for (const d of seed.documents.filter((x) => CARD_KINDS.has(x.kind))) {
    const base = d.key.replace(/-(pdf|dsh)(?=-)/, "");
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base).push(d);
  }
  const rank = (d) => (/-pdf-/.test(d.key) ? 0 : /-dsh-/.test(d.key) ? 1 : 2);
  return [...groups.values()].map((docs) =>
    docs.sort((a, b) => rank(a) - rank(b)),
  );
}

const fmt = (m) =>
  `${m.id} | ${m.displayName} | api: ${m.apiIds.join(", ") || "-"} | checkpoints: ${m.checkpoints.join(", ") || "-"}`;
const [cmd, arg = ""] = process.argv.slice(2);

if (cmd === "card") {
  const group = cardGroups().find((g) => g.some((d) => d.key === arg));
  if (!group) throw new Error(`No card with document key "${arg}"`);
  console.log(
    "Documents of this card (read the first; list the others in alsoDocuments):",
  );
  for (const d of group)
    console.log(
      `  ${d.key} | ${d.kind} | ${d.publishedDate ?? "?"} | ${d.url}`,
    );
  const keys = new Set(group.map((d) => d.key));
  console.log("Seed models linked to these documents (likely the `covers`):");
  for (const m of seed.models.filter((m) =>
    m.documents.some((k) => keys.has(k)),
  ))
    console.log(`  ${fmt(m)}`);
} else if (cmd === "models") {
  const q = arg.toLowerCase();
  for (const m of seed.models) {
    const hay = [m.id, m.displayName, ...m.apiIds, ...m.checkpoints]
      .join(" ")
      .toLowerCase();
    if (hay.includes(q)) console.log(fmt(m));
  }
} else if (cmd === "cards") {
  for (const g of cardGroups())
    console.log(
      `${g[0].publishedDate ?? "?"} ${g[0].publisherId} ${g.map((d) => d.key).join(" ")}`,
    );
} else if (cmd === "evals") {
  const dir = fileURLToPath(new URL("../../data/seed/evals/", import.meta.url));
  const q = arg.toLowerCase();
  for (const f of readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()) {
    const { eval: e } = JSON.parse(readFileSync(dir + f, "utf8"));
    const line = `${e.slug} | ${e.displayName} | aliases: ${e.aliases.join(", ") || "-"} | ${e.access} | by ${e.maintainers.map((m) => m.name).join(", ")}`;
    if (line.toLowerCase().includes(q)) console.log(line);
  }
} else {
  console.log(
    "Use: card <document key> | models <text> | cards | evals [text]",
  );
}
