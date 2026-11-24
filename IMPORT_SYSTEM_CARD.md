# Import a system card

This guide tells an agent how to add one new document (a system card, safety report, model page or
technical report) to OpenAudit, from the seed entry to the pages on the site. Follow the steps in order.

Run commands from the repo root unless a step says `apps/web`.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path. Do not commit files that you did not make:
  other agents work in this repo at the same time.
- Two steps change shared systems. Do them only when the user says so:
  - `pnpm seed:import --apply` writes to the database.
  - `pnpm docs:mirror --apply` uploads to R2.
- Never reset a database.
- Never print secrets. The env files have database URLs and tokens. Filter `postgres://` out of any
  output that you show.
- Do not re-serialize JSON files with a different formatter. Edit only the text of the entries that you
  change. The extraction files have mixed styles, and a rewrite changes their quotes and escapes.
  `data/seed/system_cards.json` is plain `json.dumps(indent=2, ensure_ascii=False)` plus a newline, so
  that exact call keeps its format.

## Files

| File                                         | What it holds                                                |
| -------------------------------------------- | ------------------------------------------------------------ |
| `data/seed/system_cards.json`                | Organizations, models, documents and the links between them  |
| `data/seed/hf_snapshot.json`                 | Hugging Face Hub facts for `hf` models                       |
| `data/seed/evals/<slug>.json`                | The eval registry, one eval per file                         |
| `data/extracted/system-card-prompt.txt`      | The extraction prompt, for one document                      |
| `data/extracted/system-cards/<key>.json`     | One extraction per document                                  |
| `data/extracted/eval-links.txt`              | Checked URLs for evals that are not in the registry          |
| `data/seed/eval-prompt.txt`                  | The prompt that writes new registry entries                  |
| `data/extracted/result-directions.jsonl`     | Safety and skill directions of results (step 6)              |
| `data/extracted/result-direction-prompt.txt` | The prompt that sets new directions                          |
| `data/cache/documents/<key>.pdf` or `.html`  | Saved copies of documents (gitignored)                       |
| `apps/web/lib/runs/route-overrides.json`     | Fixes for wrong OpenRouter matches (step 8)                  |

## 1. Add the document to the seed

Edit `data/seed/system_cards.json`. It has three lists: `organizations`, `models` and `documents`.

### Document

Add one entry at the end of `documents`:

```json
{
  "key": "anthropic-claude-opus-5-5-system_card",
  "kind": "system_card",
  "title": "System Card: Claude Opus 5.5",
  "url": "https://www.anthropic.com/claude-opus-5-5-system-card",
  "publisherId": "anthropic",
  "publishedDate": "2026-09-22",
  "verified": true,
  "notes": "Redirects to a www-cdn.anthropic.com PDF."
}
```

- `key`: `<organization>-<model>-<kind>`, lowercase, with hyphens. It must be unique. Look at keys of the same
  organization and use the same pattern.
- `kind`: one of `system_card`, `safety_report`, `model_page`, `technical_report`, `blog`.
- `publisherId`: an organization `id`. For a report by an independent tester (for example UK AISI), use the
  tester's organization, not the developer's. The model page then shows it under "Third-Party Audits", and the
  Deploymeter judges read it as third-party evidence.
- `publishedDate`: `YYYY-MM-DD`, or `YYYY-MM` when the day is not known.
- `verified`: `true` only when you opened the URL and it is the right document from the right publisher.
- `notes`: for reviewers. Not shown on the site. Use `""` when there is nothing to say.

One card can have more than one document, for example a web page and its PDF. Keys that are the same
after you remove `-pdf` or `-dsh` are one card. The extraction reads the `-pdf-` document first.

### Models

Each model that the document covers must be in `models`, and its `documents` list must have the new key.
To find a model, run:

```sh
node spec/scripts/seed-lookup.mjs models "opus 5.5"
```

If the model is in the seed, add the document key to its `documents` list. If it is not, add a new entry
at the end of `models`:

```json
{
  "id": "anthropic/claude-opus-5.5",
  "source": "api",
  "displayName": "Claude Opus 5.5",
  "organizationId": "anthropic",
  "family": "Claude 5.5",
  "releaseDate": "2026-09-22",
  "whyMajor": "Current recommended default Claude model",
  "documents": ["anthropic-claude-opus-5-5-system_card"],
  "checkpoints": [],
  "apiIds": ["claude-opus-5-5"]
}
```

- `source`: `api` for a model that you use through an API, or `hf` for open weights.
- `id`: for `hf`, the Hub repo id (`allenai/Olmo-3-7B-Instruct`). For `api`, `<organization id>/<model name>`.
- `checkpoints`: other Hub repos of the same model (sizes, bases). `apiIds`: the API model names.
- Link a document only to the models that it is about. Do not link it to models it only compares
  against. Do not link a later model to an earlier report that does not name it.

### Organization

If the publisher is new, add it to `organizations`. That list is sorted by `id`. The `id` is the
page URL (`/qwen`): the model owner that most of its models use, in lowercase. `slugAliases` are
other slugs that redirect to it: old slugs and other model owners, in lowercase.

```json
{ "id": "anthropic", "displayName": "Anthropic", "aliases": [], "slugAliases": [] }
```

### Hub facts (hf models only)

For each new `hf` model, run:

```sh
node data/scripts/fetch-hf.mjs --only <repo id>
```

It updates `data/seed/hf_snapshot.json`. It reads the token in `HF_TOKEN` or
`~/.cache/huggingface/token`. Do not print the token.

### Check the seed entry

```sh
node spec/scripts/seed-lookup.mjs card <key>
```

It must list the documents of the card and the linked models. It works only for `system_card`,
`safety_report` and `model_page`. For other kinds, see step 3.

## 2. Get a saved copy (optional; ask the user first)

A saved copy lets the site show exact PDF pages. It also gives the extraction a stable file.

```sh
cd apps/web
pnpm docs:mirror --only <key>            # dry run
pnpm docs:mirror --only <key> --apply    # uploads to R2; only with the user's OK
```

With `--apply`, the file goes to R2 and to `data/cache/documents/<key>.<pdf|html>`. A site that blocks
scripts (403) is skipped. Without a saved copy, the extraction downloads the file itself (step 3).

## 3. Extract the document

Use one agent for each document. More than one agent can run at the same time: each one works only in
`/tmp/oa-cards/<key>` and writes only its own output file. We use Sonnet 5.5
(`claude-sonnet-5-5-high`) for extraction agents.

The prompt is `data/extracted/system-card-prompt.txt`. Replace each `{KEY}` with the document key, and
give the whole text to the agent as its task.

For a `system_card`, `safety_report` or `model_page`, the prompt is complete.

For a `technical_report` (or any kind that `seed-lookup card` does not find), put this block after the
prompt. Fill in the values from the seed:

```text
OVERRIDES (they replace the prompt's step 1, because this document is a technical report and
`seed-lookup card` only finds system cards and safety reports):
Document: <key>, technical_report, "<title>", <url>, published <date>, publisher <organization id>.
Get it from: <PDF URL, e.g. https://arxiv.org/pdf/<id>>
Seed models linked (a hint only): <model ids>.
alsoDocuments: [<other keys of the same card>] (do not fetch them).
Do not commit, push, upload or publish anything.
```

The agent writes `data/extracted/system-cards/<key>.json`. It runs the checker with `--text`, which
compares every quote with the document text. It also runs `locate-pages.mjs` when there is a saved PDF.

## 4. Review the extraction

Do not trust the agent's reply alone. First run the checker yourself:

```sh
node spec/scripts/check-extraction.mjs --text /tmp/oa-cards/<key>/text.txt data/extracted/system-cards/<key>.json
```

It must print OK. Warnings about models that are not in the seed are fine. Then read the file and check
these problems. We found each of them in earlier batches:

- **covers**: only the models the document is about. A comparison model is not covered.
- **Duplicate results**: two documents from the same source (a paper and its supplement, for example)
  must not both hold the same numbers. Keep them in one file.
- **Wrong kind of result**: results that score the model as a classifier or moderation tool are not
  results about the model's own behavior. Remove them, and say why in `notes`.
- **Eval names**: `rawEvalName` should match a registry eval's name or alias when it is that eval, so the
  result links to it. List registry evals with `node spec/scripts/seed-lookup.mjs evals`.
- **Risk decisions**: leave `level` out when the framework has no threshold for that domain, and for
  comparisons or general claims.
- **Values**: never the midpoint of a range. Chart bars must match models by colour.
- **Text**: the rules in the prompt for abbreviations, decimals, "(higher is better)" and eval links.

Fix problems by editing the text of the entries. Then run the checker again.

## 5. Evals that are not in the registry

```sh
node spec/scripts/check-eval-seed.mjs --names
```

It lists the most common eval names in cards that match no registry eval. For a safety eval that many
cards use, add a registry entry. Use the prompt in `data/seed/eval-prompt.txt`, with the eval names after
`EVALS:`. Then run `node spec/scripts/check-eval-seed.mjs` to check the new files.

For an eval that should not be in the registry, add its paper or repo URL to
`data/extracted/eval-links.txt`, as `Name | Alias -> URL`.

After you add a registry eval or a link, older cards can name that eval without a link. Run the checker
on all files (no file names) and fix each error that it prints:

```sh
node spec/scripts/check-extraction.mjs
```

## 6. Result directions

Each result has two directions: which way is better for safety, and which way shows more skill. For
example, a higher "attack success rate" is worse for safety, and a higher cyber CTF score shows more
skill but is `neither` for safety. Refusals of safe requests are `neither` for safety. A signed bias score,
where 0 is best, is `nearer_zero_is_better`. `data/extracted/result-directions.jsonl` holds them, one line for each
(eval name, metric) key. The importer copies them onto each result. A new card often uses keys that are
not in the file yet:

```sh
node spec/scripts/result-directions.mjs                           # counts the keys with no direction
node spec/scripts/result-directions.mjs todo /tmp/oa-directions   # writes them to in/batch-NN.jsonl
```

For each batch, give an agent the prompt in `data/extracted/result-direction-prompt.txt`, with
`INPUT = /tmp/oa-directions/in/batch-NN.jsonl` and `OUTPUT = /tmp/oa-directions/out/batch-NN.jsonl`. We use
Sonnet 5.5. Then check each batch and add it to the file:

```sh
node spec/scripts/result-directions.mjs check /tmp/oa-directions/in/batch-00.jsonl /tmp/oa-directions/out/batch-00.jsonl
node spec/scripts/result-directions.mjs merge /tmp/oa-directions/out/*.jsonl
```

Read the new lines before you merge them. Look for a `refusal rate` on harmful prompts with
`lower_is_better`, and for a capability eval with a safety direction. The first command must then print 0
keys with no direction.

## 7. Import to the database (ask the user first)

```sh
cd apps/web
pnpm seed:import --only documents,models,cards            # dry run
pnpm seed:import --only documents,models,cards --apply    # writes; only with the user's OK
```

- The parts, in order, are: `organizations`, `documents`, `models`, `evals`, `samples`, `cards`. Add
  `organizations` for a new organization and `evals` for new registry entries. With no `--only`, it imports all
  parts.
- The first line says which database it uses. `apps/web/.env.local` sets it, usually a Neon dev branch.
- Read the dry run. It shows rows to create (`+`), rows to update (`~`) and rows that are in the database
  but not in the seed (`?`). It does not delete rows. It also prints how many results match a registry
  eval. Results that a person reviewed in the database are kept.
- A second run with no seed changes must show no changes.

If you mirrored the document after the extraction (step 2), run
`node spec/scripts/locate-pages.mjs --write data/extracted/system-cards/<key>.json`, and then import
`cards` again. This adds the PDF page to each source.

## 8. Run routes

The site finds each model on OpenRouter when the page loads, and shows a Run button when it has a route.
It pins one provider: the organization's own, else a licensed cloud for API models, else a host that
states bf16, fp16, fp32 or fp8 weights. Check the new models with the same rule:

```sh
cd apps/web
pnpm routes:check <model id> [<model id> ...]
```

It prints each model's OpenRouter model and provider, or why it has no route.

- Each route must be the same model and version as the seed model. A newer snapshot or a moving alias
  (for example `-latest`) is not the same model.
- To fix a wrong match, edit `apps/web/lib/runs/route-overrides.json`, then run the check again.
  `{ "model": "<OpenRouter id>" }` sets the OpenRouter model. `null` gives the model no route.
- A new model is often not on OpenRouter yet. Its Run button shows when OpenRouter adds it, with no
  change from us. Check it again then.
- A change to `route-overrides.json` goes live with the next deploy.

## 9. Check the site

Start the dev server with `pnpm dev` from the repo root. It runs on port 3300. If a server is already
running, use it. Then open these pages:

- The card: `http://localhost:3300/<model id>/cards/<key>` for a `system_card`, and
  `http://localhost:3300/<model id>/reports/<key>` for other kinds.
- The model's combined system card: `http://localhost:3300/<model id>/system-card`.
- The model page: `http://localhost:3300/<model id>`. It must list the document.
- Search: `http://localhost:3300/api/search?q=<title words>` must return the document.

Check that eval links go to `/evals/<slug>`, and that source links open the right page.

## 10. Final checks and commit

```sh
pnpm lint
pnpm test
```

The pre-commit hook runs the same two commands. Commit only when the user asks. Add only your files,
by path:

```sh
git add data/seed/system_cards.json data/extracted/system-cards/<key>.json
git commit -m "Add <title>"
```

Also add `data/seed/hf_snapshot.json`, `data/seed/evals/<slug>.json`, `data/extracted/eval-links.txt`,
`data/extracted/result-directions.jsonl` or `apps/web/lib/runs/route-overrides.json` when you changed
them. Do not push.
