# Add an incident

This guide tells an agent how to add an AI safety incident to OpenAudit, or rewrite the page of
an incident that we have. Follow the steps in order.

The repo root is the folder of this file. Run commands from `apps/web` unless a step says
the repo root.

## The incident page

Each incident has a page at `/<org>/incidents/<slug>`. Feeds and lists link to it. The page is
short. It has one of two forms:

- **Model behavior, with logs.** For an incident with a `model_*` primary category, when the
  sources show what the model did: the description, then "From the Logs". Each excerpt has a
  title, a description and the steps of the conversation (user, model, thinking, tool calls,
  tool output), copied from the source. The page shows all excerpts, grouped by source.
- **Other incidents.** The description, the categories, a link to the story, and a short
  timeline. The timeline shows only when more than one article tells the story (two or more
  dated events with different source URLs).

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- `pnpm seed:import --apply` writes to the database. Use the dev database. Write to the
  production database only when the user says so.
- The script in steps 2 and 3 makes paid model calls. One incident costs a few cents to about
  $1 (a long report or a PDF with many pages). All incidents cost about $30. Tell the user before a
  run over all incidents.
- Never print secrets: filter `postgres://` and `npg_` out of any output you show.
- Do not re-serialize the org files. The script changes only the field that it writes (`logs` or
  `description`) and keeps the rest of the text as it is.

## 1. Add the incident to the seed

New posts on the incident pages that labs publish (OpenAI's misalignment reports):

```bash
node data/scripts/check-incident-sources.mjs   # repo root
```

Add the incident to `data/seed/orgs/<org>.json`. Follow the rules in
`data/seed/org-research-prompt.md`: scope, title, careful wording, severity, categories, models,
dates and sources. Then look for duplicates in all orgs:

```bash
python3 data/scripts/check-incident-duplicates.py   # repo root
```

Merge each real duplicate into one incident. Add a pair that is not a duplicate to `SEPARATE`
in the script. Put every source in `sources` (the primary source first: the lab's report,
the system card, the paper), and each later article in a `timeline` event. Leave `description`
as one sentence. Step 3 rewrites it. Do not write `logs` by hand. Step 2 writes them.

## 2. Write the log excerpts

Only for incidents with a `model_*` primary category. First run with no `--write`, to see the
result:

```bash
pnpm exec node scripts/with-env.mjs tsx scripts/incident-pages.ts logs <org>/<slug>
pnpm exec node scripts/with-env.mjs tsx scripts/incident-pages.ts logs <org>/<slug> --write
```

`<org>` or `all` in place of `<org>/<slug>` does every `model_*` incident of the org, or of all
orgs. `--write` replaces the incident's `logs`.

How it works (`scripts/incident-pages.ts`, `scripts/incident-sources.ts`):

- The script reads the incident's sources, primary sources first. It reads a news story only
  when the primary sources give no excerpts, and it stops after the first story that gives some.
- **OpenAI misalignment reports** (`alignment.openai.com/misalignment-reports/<post>/`): the
  script copies each log block of the report as it is. The model only groups the blocks into
  excerpts and writes the titles and descriptions. A block label maps to a role in `labelRole`.
  A label that it does not know becomes a tool result: add the label to `labelRole` and its test.
  `parseReport` reads the formats that OpenAI used so far (a role block, a cell of a one-column
  table, and a CoT with "Original" and "Translation" views: only the original is copied). When a
  report has a label ("CoT", "Tool call") that is not in a block that it reads, the script stops
  for that incident. Add the new format to `parseReport` and its test, then run again.
- **Other sources** (web pages, PDFs): the model copies the excerpts. It reads up to 8 images of
  a page, and copies the text of chat or terminal screenshots (`ocr: true`). The script drops a
  step whose text is not in the source text. It does not check text from images.
- The model is the first `incident_writer` model in `spec/model-ladders.yaml` that is not of the
  incident's lab. When a model refuses (this is frequent for cyber incidents), the script asks the
  next one.
- Caches: pages in `data/cache/incident-sources/`, replies in `data/cache/incident-pages/`. A
  second run is free. `--fresh` asks the model again and fetches failed pages again.

Some sites block the script (HTTP 403 or 401). Pages on X and other social sites need a browser,
so the script skips them. If the logs are only there, save the page or its screenshots and give
the script a copy that it can read (a source URL to a PDF or a page that loads).

Review each excerpt (`logs` in the org file):

- Each log in the source is in an excerpt, unless it does not show the incident. For a report,
  compare the excerpts with the report's CoT and tool blocks.
- The excerpts show the incident: what the model did, and the prompts and setup directly around
  it. Not product demos, or examples of good behavior. Delete an excerpt that does not belong.
- The text is the source's text. Check OCR excerpts against the screenshots.
- The titles are 3 to 8 words. The descriptions are 1 or 2 short sentences, neutral, and they
  agree with the source.
- The roles are correct: the model's chain of thought is `reasoning`, a command is `tool_call`,
  its output is `tool_result`.

You can edit `logs` by hand: delete an excerpt or a step, or fix a title or a role. Do not
change step text, except to cut it with `[...]`. A run with `--write` replaces hand edits.

## 3. Write the description

```bash
pnpm exec node scripts/with-env.mjs tsx scripts/incident-pages.ts describe <org>/<slug>
pnpm exec node scripts/with-env.mjs tsx scripts/incident-pages.ts describe <org>/<slug> --write
```

The model writes 2 or 3 short sentences (at most 60 words): what happened, who or what it
affected, and the main result. It links one or two of the incident's sources inline. It writes
claims as claims. The script refuses a reply with more than 75 words, more than one paragraph,
or a URL that is not one of the incident's sources. Read the result, and check each fact against
its source.

## 4. Import

From `apps/web`. First the plan, then the write:

```bash
pnpm seed:import --only research
pnpm seed:import --only research --apply
```

The import checks each file against `spec/schemas/organization_research.yaml`. Fix any error
that it shows and run it again.

## 5. Check the page

Open `/<org>/incidents/<slug>` on desktop and at phone width:

- The meta line shows the right severity, dates, organization and models.
- The excerpts are in order, and each step shows its role. Long tool output scrolls in its box.
- For an incident with no logs, the timeline shows only when there are many articles.
- The incident shows in the feeds of the org page and its models' pages, and it links to its page.

## Change the format

The format of `logs` is `IncidentLog` in `spec/schemas/organization_research.yaml`. After a
change, run `pnpm spec:generate` from the repo root. The page is
`apps/web/components/org/incident-view.tsx`.
