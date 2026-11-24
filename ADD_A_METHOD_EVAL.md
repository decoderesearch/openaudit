# Add a method evaluation

This guide tells an agent how to add an evaluation of safety methods to OpenAudit: the eval seed, an
optional suite, the results, the data of each item and the import. Follow the steps in order. A method eval scores methods that inspect a model (SAEs, probes, lenses,
monitors), not models. The design is in `openaudit-private/plans/methods.md` ("Method evals"). If you have access to it, read it first. To start
an agent on this guide, use the prompt in `data/seed/method-eval-prompt.txt`.

The repo root is the folder of this file. Run commands from the repo root unless a step says
`apps/web`.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- Ask the user before each step that writes to shared systems or costs money: a prod import, a delete
  of rows, and eval runs. Show the dry run first.
- Never reset a database. Never print secrets: filter `postgres://` out of any output you show.

## A submitted method evaluation harness

For a pull request with `submissions/harnesses/<harness>/` (`submissions/harnesses/README.md`):
the review steps are private (maintainers: `openaudit-private/process/review-submissions.md`).
Then do the steps below from step 4.

## 1. Find the kind of eval

- **Method benchmark**: it tests if a method works, apart from a safety task (SAEBench,
  SynthSAEBench, Workspace Lens Readout). `topics` is `[]`.
- **Topic eval**: it tests methods on a safety task (Varied Deception: lie detection). It has a
  topic, and it ranks variants across methods.
- **Suite**: a set of evals from one source with one page (SAEBench has eight). Add a suite only when
  the source has more than one eval.

Each method and variant that the eval tests must be in `data/seed/methods/`. If one is missing, add
it first with `ADD_A_METHOD.md`.

## 2. Write the eval seed

Add `data/seed/evals/<slug>.json` with `subjects: ["method"]`. The schema is `Eval` and
`EvalVersion` in `spec/schemas/eval.yaml`. Copy a similar eval:

- `sae-bench-scr.json`: an eval in a suite (`"suite": "<suite slug>"`).
- `workspace-lens-readout.json`: a benchmark with no suite.
- `varied-deception.json`: a topic eval with `methodSetup`.

The parts:

- `summary`: one sentence on what the eval tests. `description`: what it does, on which models, how
  it scores, and its known limits.
- `links`: the paper, the code, the data and the site. `EvalLink` has no date, so put the year in a
  title when it helps.
- `versions[0].metrics`: the metrics of the source, each with `direction` and a `description`. One
  metric has `headline: true`: the pages rank on it.
- `versions[0].scores` (evals with samples): one score for each method. The sample page marks each
  one pass or fail: a detector's call (`answer`) against the reply's label (`lie` or `honest`), else
  the score's `pass` rule or direction (`ADD_AN_EVAL.md`, step 2), as a lens score of 1 or 0. When
  all have a mark, the top of the page shows how many passed ("2 of 4 Passed"). Give a score with no
  pass or fail `direction: "neither"`.
- `versions[0].methodSetup` (topic evals): `definition` (what counts as a positive case),
  `calibration` (how each detector sets its threshold) and `subjectOrder` (how to sort the subject
  models, with its source).

Check the file:

```sh
node spec/scripts/check-eval-seed.mjs <slug>.json
```

## 3. Write the suite seed (only for a suite)

Add `data/seed/eval-suites/<slug>.json`. Copy `saebench.json`:

- `summary`: one sentence. It shows under "The Evaluation Suite" on the suite page.
- `description`: the evals, the models, how to compare, and the age of the results.
- `maintainers`, `links`, and `evalOrder`: the evals in the order of the page (safety tasks first).
- `matched` (optional): compare variants at set values of one metric of one eval, for example
  SAEBench at a set Core L0. Without it, each eval ranks on its own.

## 4. Get the results

Do not type results by hand. Write `data/scripts/fetch-<source>.mjs` that reads the source and
writes `data/extracted/methods/<source>.json`. The format is in `ADD_A_METHOD.md`, step 5. Copy
`fetch-saebench.mjs` (Hugging Face result files) or `fetch-jpp-lens.mjs` (paper tables).

Check the values before you import:

- Look for placeholders. A source can write `-1`, `0` or `NaN` for a metric that it did not compute.
  SAEBench writes `-1` for all its KL metrics on Pythia. Drop them in the fetch script
  (`NOT_COMPUTED` in `fetch-saebench.mjs`), and tell why in a comment.
- For each metric, print the count, the minimum, the median and the maximum for each subject model.
  A model with only one value, or with values out of range, is a sign of a bad extraction.

## 5. Keep the data of each item (evals with samples)

Metrics do not show why a method passed. When the run has data for each item (readouts, trials,
judge verdicts), import it as a run. Then each item has a sample page that shows the data. The
Workspace Lens Readout and Workspace Probe Swap evals do this.

1. Keep the raw files of the run in `data/cache/<slug>/` (git ignores `data/cache/`). Put the
   sha256 of each file in the extracted file, under `source.inputs`
   (`fetch-openaudit-lens-readout.mjs` does this).
2. Write `data/scripts/<slug>-logs.py`. It writes one Inspect log for each subject model, with one
   sample for each item: the prompt, the target, the model's reply, one score for each key of
   `versions[].scores`, and the data of the item in the sample metadata under one key. Run it with
   the runner's Inspect version: `cd apps/runner && uv run python ../../data/scripts/<slug>-logs.py`.
   Copy `workspace-lens-readout-logs.py` (metadata `lensReadout`: the top tokens and the rank of
   each hidden token, for each lens and layer) or `workspace-probe-swap-logs.py` (`probeSwap`: the
   trials of each lens at each scale, and the controls).
3. Import each log (ask the user first):
   `cd apps/runner && uv run openaudit-runner import <log> --model <subject> --eval <slug>`.
   It puts the log and each transcript in the R2 bucket, and the run, attempts and scores in
   Postgres. It uses the `DATABASE_URL` and R2 keys of its environment: make sure that they are
   for dev, without printing them. The same file again does nothing. `--run-id` replaces a run.
   Do not import on production: step 8 copies the run.
4. Show the data. For a new metadata shape, add `apps/web/lib/runs/<name>.ts` (the type, a parser
   that gives null for a wrong shape, and the metadata keys that the generic list leaves out) with
   a test, and `apps/web/components/runs/<name>.tsx`. Add both to
   `components/runs/attempt-view.tsx`. Copy `lens-readout.ts` and `lens-readout.tsx`. A chart over
   all samples of a run goes in `components/runs/run-view.tsx` (see `swapCurves` in
   `lib/server/probe-swap.ts`).

Each sample page loads its full transcript, so keep the metadata of one item small (megabytes, not
more). The raw files stay the source: a new version of the eval makes new logs from them.

## 6. Import (dev)

```sh
cd apps/web
pnpm seed:import --only evals,methods            # dry run
pnpm seed:import --only evals,methods --apply
```

For an eval of a harness, also run `node submissions/leaderboards.mjs`: it writes the harness's
`leaderboard.json` and its README table.

The dry run must show only your changes. If it shows changes that you did not make, another agent
has seed edits that are not imported. Stop and ask the user.

The import does not delete rows. A result that is no longer in the extracted file shows as "in the
database only". Delete such rows with a script that counts them first and stops when the count is
not the expected one. Ask the user before you delete on production.

## 7. Check the pages

Open these on `http://localhost:3300`:

- `/evaluations/<slug>`: the about panel and the leaderboard.
- `/evaluations/suites/<slug>` for a suite: The Evaluation Suite, Methods Tested, the description,
  the evals and the scorecard.
- `/methods/<method>` for each method that the eval tests, and the Method Evaluations list on
  `/methods`.
- For an eval with samples, one sample page of each kind: the marks under Results, the count at
  the top, and the view of the item's data (step 5).

## 8. Production (ask the user first)

Run the seed import on production, then delete the bad rows if any (step 6). Then ask the user to
copy the runs of step 5 with `/admin/sync` on the local server. Sync keeps the run ids and R2 keys.
A second import makes a run with another id, so the import refuses a log that another database has.

## 9. Final checks and commit

```sh
cd apps/web
pnpm test
```

Commit only when the user asks. Add only your files, by path: the eval and suite seeds, the fetch
script and its output, the logs script and the view files. Do not push.
