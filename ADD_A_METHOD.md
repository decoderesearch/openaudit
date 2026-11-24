# Add a new method

This guide tells an agent how to add a safety method to OpenAudit: the seed entry with its variants,
the expert views, the expert summary, the results and the import. Follow the steps in order. The
design and its reasons are in `openaudit-private/plans/methods.md`. If you have access to it, read it first.

The repo root is the folder of this file. Run commands from the repo root unless a step says
`apps/web`.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- Ask the user before each step that writes to shared systems or costs money: `--apply` of a seed
  import, a prod import, and eval runs. Show the dry run first.
- Never reset a database. Never print secrets: filter `postgres://` out of any output you show.

## 1. Check the scope

A method is in scope only if people use it to make or check a safety claim about a model. In scope:
SAEs, probes, lenses, steering, monitors, safeguard classifiers, auditor agents, LLM judges, red-team
attack methods, unlearning. Out of scope: general ML methods (optimizers, quantization, RAG, fine-tuning
recipes). If you cannot write that claim in one line, stop and ask the user.

Find out if the method is a new method or a variant of a method that we have. A new training recipe
for SAEs is a variant of `sparse-autoencoders`, not a new method.

## 2. Write the seed entry

Add `data/seed/methods/<slug>.json` with three parts: `method`, `variants` and `views`. The schema is
`spec/schemas/method.yaml`. Copy the pattern of a method that is similar:

- `probes.json` or `llm-monitors.json`: a method that a topic eval (Varied Deception) tests.
- `sparse-autoencoders.json`: a method that a method benchmark (SAEBench) ranks. The benchmark is
  an eval suite (`data/seed/eval-suites/`), and its `matched` rule tells how to compare.

The `method` part:

- `group`: `white_box` or `black_box`. `summary`: one sentence on what it is. `tagline`: at most 60
  characters on what it does, for lists (the home page). `safetyUse`: how it supports a safety
  claim, and how it did in the main tests.
- `caveats`: the main limits in short sentences. `params`: the settings that the artifacts must
  give. `compare`: how to compare artifacts (`{ "groupBy": [] }` if each subject has one artifact for
  each variant).
- `links`: the sources about the method in general, oldest first: the founding papers, the main
  follow-ups, the code, the data and the site. Not one benchmark: a benchmark's links go on its
  evals. For SAEs: Sharkey et al. 2022, Cunningham et al. 2023, Towards Monosemanticity, Scaling
  Monosemanticity, Gao et al. 2024, Gemma Scope, SAELens, Neuronpedia. `EvalLink` has no date, so
  put the year in each title. A system card or a technical report has the kind `paper`; model
  weights have `homepage`.
- `expertSummary`: write it last (step 4).

A variant's `summary` and `links` tell what is new or different in the variant: what its design
changes (for example "TopK removes the L1 penalty and its shrinkage"), with its own paper, code and
weights. Do not repeat what is true for all variants.

Each variant has `slug`, `displayName`, `aliases` (the names that sources use), `access`, `summary`,
`baseline` (`true` for a reference that does not get a rank), `params` and `links`. Use `components`
and `supersedes` only when a variant is made of others, or replaces one.

The site finds methods from the database, so its pages need no list in the code. Only a method that takes submissions needs one: its entry in `HARNESSES` (`apps/web/lib/submissions.ts`).

## 3. Add the expert views

Each item in `views` is what researchers said in one public post or paper. Keep the source's nuance:

- `stance`: `positive`, `negative` or `mixed`. Add only views about this method, not about a rival
  method.
- `quotes`: the source's exact words, each with its URL. `variants`: the variants that the source
  names.
- `checkedDate`: the day on which you read the source.

A source about two methods gets one view in each method file, each with its own stance. A view can
name only the variants of its own file; a source about the whole method gets `variants: []`.

Views are current opinions: most from the last 18 months. Old founding papers go in `links`, not in
`views`. Aim for 5 to 15 views from different places: papers, lab blogs, LessWrong and the
Alignment Forum, and lab system cards. The newest system cards show how a lab really uses a method,
and when it stops.

How to select sources:

- Do not use product marketing: a post or paper that mainly sells a product or a partnership.
- Prefer papers that have many citations, or that come from an organization whose work has many
  citations.
- For interpretability methods, give extra points to work from MATS (the ML Alignment & Theory
  Scholars program) and its scholars.

How to find and check sources:

- Read the related work and the references of the newest main paper first. One paper can give many
  views.
- Do not trust the summary of a search result. Open each source.
- Exact text: arXiv `/html/<id>` for the full paper (many quotes are not in the abstract), LessWrong
  `/api/post/<slug>`, and `pdftotext` for PDFs. Some sites need WebFetch, not `curl`.
- Dates, authors and titles: the arXiv export API
  (`https://export.arxiv.org/api/query?id_list=...`), batched. Titles change between versions; use
  the current one. Use the first arXiv date. LessWrong dates are in the JSON-LD `datePublished`.
- Check each quote with a script: make quotes, dashes and spaces the same, then test the quote as a
  substring of the page text. Copy each quote from the URL that you cite: arXiv abstract pages use
  straight apostrophes, and the HTML pages use curly ones. Numbers can differ between paper versions;
  use one version.
  arXiv HTML text also has line breaks inside sentences and spaces before punctuation.
- Check bylines: a forum handle is not a full name. Find the name in a paper's reference list.
- A result about one method is often a side test in a paper about another (SAE probes in the
  Apollo probes paper). It is enough for a view in that method's file; say "side test" in the
  points. When the source already has a view in another file, read it first, and do not repeat it.
- Name a variant only when the source shows it. For example, Gemma Scope SAEs are `jumprelu`. If a
  paper does not name the SAE type, use `[]`.
- When sources disagree (for example on a count), write who said what ("AISI used 50").
- A view has one stance and one `organization`. If a source praises one variant and criticizes
  another, use `mixed` and tell which is which in the points. Leave out `organization` when the
  source gives no affiliation.

## 4. Write the expert summary

`method.expertSummary` is the text above the views on the method page. Write it after the views,
from the views only: where the experts agree, and where they disagree. Use 2 or 3 short sentences
and 50 words or fewer, in plain words. Do not name people, and do not add links. When you add or
remove a view, read the summary again and change it if it is no longer correct.

## 5. Add the evals and the results

Results need an eval with `subjects: ["method"]`. Use one that we have
(`varied-deception`, the `sae-bench-*` evals, `synth-sae-bench-16k`), or add one with
`ADD_A_METHOD_EVAL.md`.

Do not type results by hand. Write a script `data/scripts/fetch-<source>.mjs` that reads the source
(a paper table, a Hugging Face repo, a results file) and writes
`data/extracted/methods/<source>.json`. Copy `fetch-aisi-lie-detection.mjs` or
`fetch-synth-saebench.mjs`. The file has this form:

```json
{
  "source": { "paper": "<url>" },
  "artifacts": [
    {
      "key": "<source>/<variant>/<subject>",
      "method": "<method slug>",
      "variant": "<variant slug>",
      "displayName": "<variant>, <subject>",
      "subject": "<Hub name of the model>",
      "sites": [{ "role": "read", "source": "layer 20" }],
      "params": {},
      "results": [
        {
          "eval": "<eval slug>",
          "version": "<eval version, when the eval has more than one>",
          "sourceUrl": "<url>",
          "sourceTable": "Table 9",
          "metrics": { "<metric key>": 0.85 }
        }
      ]
    }
  ]
}
```

Each key in `params` must be a param of the method or the variant. Each metric must be a metric of
the eval version.

When the source has files to download (probe weights), give each artifact `files`:
`[{ "name", "url", "sha256", "bytes" }]`, with the `url` at a commit (Hugging Face
`resolve/<commit>/<file>`). `fetch-aisi-lie-detection.mjs` reads them from the Hub.

## 6. Import the seed (ask the user first)

First save a copy of each new artifact file in R2. The site links to that copy, so a download
works when the source goes away. The bucket is shared with prod: ask the user first.

```sh
cd apps/web
node scripts/with-env.mjs tsx scripts/mirror-artifact-files.ts           # dry run
node scripts/with-env.mjs tsx scripts/mirror-artifact-files.ts --apply   # uploads; writes `mirror`
```

Commit the `mirror` keys that it writes. Then import:

```sh
pnpm seed:import --only evals,methods            # dry run
pnpm seed:import --only evals,methods --apply    # writes; only with the user's OK
```

The dry run must show only your changes. If it shows changes that you did not make, another agent
has seed edits that are not imported. Stop and ask the user. A prod import needs the user's OK.
The import deletes the expert views that left their method's file.

## 7. Check the pages

Open these on `http://localhost:3300`:

- `/methods`: the method is in the left column, with its group and its variants. Variants with
  results have medals.
- `/methods/<slug>`: the expert summary and views, the evals and the variants.
- `/methods/<slug>/<variant>` for each variant.
- `/methods/leaderboards/<task>` if the method detects something that a leaderboard task covers (for
  example `deception`). An eval joins a task by its topics; see `LEADERBOARD_TASKS`.
- The Methods menu in the navbar, and the page of each eval that has results.

## 8. Final checks and commit

```sh
cd apps/web
pnpm test
```

Commit only when the user asks. Add only your files, by path: `data/seed/methods/<slug>.json`, the
fetch script and its output in `data/extracted/methods/`, and any new eval seed. Do not push.

## Import a variant submission

People submit new variants of a method in `submissions/<method>/<variant>/` (see
`submissions/README.md`), or with the site's Submit form. Their own results do not go on the site.
The review steps are private (maintainers: `openaudit-private/process/review-submissions.md`).
