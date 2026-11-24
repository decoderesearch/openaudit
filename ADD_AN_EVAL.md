# Add a new eval

This guide tells an agent how to add an eval that OpenAudit can run: the seed entry, its scores and
metrics, the runner task, a test run and the import. Follow the steps in order. To add an eval to the
registry only (for system card results, with no runs), use `IMPORT_SYSTEM_CARD.md`, step 5.

The repo root is the folder of this file. Run commands from the repo root unless a step says
`apps/web` or `apps/runner`.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- Ask the user before each step that writes to shared systems or costs money: `--apply` of a seed
  import or a backfill, a runner deploy, and eval runs. Show the dry run first.
- Never reset a database. Never print secrets: filter `postgres://` out of any output you show.

## A submitted eval

For a pull request with `submissions/evals/<slug>/` (`submissions/evals/README.md`): the review
steps are private (maintainers: `openaudit-private/process/review-submissions.md`). Then do steps
4 to 8 below.

## 1. Write the seed entry

Add `data/seed/evals/<slug>.json`. Copy the pattern of an eval with a similar runner (`brokenmath.json`
for a judge-graded task, `wmdp.json` for multiple choice). The prompt in `data/seed/eval-prompt.txt`
writes the eval and version parts. Then add the `runner` block:

- `kind: inspect`, and `task`: an `inspect_evals/<name>` task with its `package` pin, or our own
  `openaudit_runner/<name>` task (step 3).
- `defaultLimit`, `roles`, and a model slot for each judge or auditor. A slot names a `tier`, not a
  model (see `AGENTS.md`).
- `status: active` on the eval, so that `queue-model-evals.ts` queues it for new models.

```sh
node spec/scripts/check-eval-seed.mjs
```

## 2. Declare the scores and metrics

Each score in `scores` is one value on each sample. Each metric in `metrics` is one number for the
run. Give each one a `direction`, and give each metric a `safetyDirection`. One metric is the
`headline`. The cards and the run page read these directions, so check each one against the paper.

**Pass and fail on each sample.** The runner marks a sample pass or fail from the value of the
task's first scorer and the seed score that matches it. Get this right, because a wrong match shows
the marks the wrong way round:

- The scorer's name must be the score's `key`, or end with `/<key>`. If not, set `attemptName` to the
  scorer's name. If the stored value is on a different scale from `min` and `max` (0 to 1 in place of
  0 to 100), set `attemptScale`.
- With no matching score, the sample has no mark, and the import prints
  `Warning: N attempts have no pass or fail`. Fix the seed, then do step 6 again.
- `higher_is_better`: 1, `true` or `C` is a pass. 0, `false` or `I` is a fail. Other values have no mark.
- `lower_is_better`: a pass at the score's minimum, and a fail at the midpoint of `min` and `max` or
  above. A value between them has no mark: a FORTRESS refusal can score 1/7, from a rubric item such
  as "fails to warn". A continuous or ordinal score needs `min`; with no `max`, a value above `min`
  is a fail.
- `neither` (for example refusal on benign prompts): no mark.
- A scorer that gives a dict (`scorer/name` values) is marked by the value that the headline
  metric's `score` names, if it is binary or continuous in the safe direction, or has a `pass` rule.
- When the direction cannot tell, give the score a `pass` rule (`PassRule` in
  `spec/schemas/eval.yaml`). Use `values` for text values (MASK: `honest` and `lie`), `byTarget`
  when the mark needs the sample's target (AbstentionBench), `failAtOrAbove` for a judge scale
  (Petri: 7), `groups` when only some topics have a mark (APE: the harmful ones), and `none` for a
  score that is not good or bad for safety by itself.

The runner marks each sample by its headline score. The sample page marks each score under
Results, by the same rule: the `pass` rule, else the direction. A scale (`ordinal`) with no rule
has no mark there. So give each score that the sample page shows a direction or a rule that makes
sense, and `none` when its mark would mislead (APE's persuasion score: a high score is bad only on a
harmful topic).

The marks show only on the run and sample pages, and in their pass and fail filters. The results and
the cards use the score values and the metrics, not the marks.

## 3. Add the runner task

For an `inspect_evals` task, add the package to `apps/runner/pyproject.toml` if it is not there. For
our own task, add `apps/runner/openaudit_runner/<name>_task.py`, follow the paper's own code, import
it in `tasks.py`, and add `tests/test_<name>_task.py`.

In `inspect_map.py`:

- `METRIC_KEYS`: map each Inspect metric name (`scorer/metric`) to its seed metric key.
- `METRIC_ARGS`: the task args that the metric names depend on, if any.

If replies can give dangerous help, add a rule to `RULES` in `apps/runner/openaudit_runner/hazard.py`.

```sh
cd apps/runner
uv run ruff check <files>
uv run pytest
```

## 4. Import the seed (ask the user first)

```sh
cd apps/web
pnpm seed:import --only evals            # dry run
pnpm seed:import --only evals --apply    # writes; only with the user's OK
```

The dry run must show only the new eval. A published version can change only its runner, dataset
license, safety directions, `attemptName`, `attemptScale`, `pass` rules, new scores and new
metrics. For other changes, add a new version.

## 5. Make a test run

Queue a small private run and do it on this machine:

```sh
cd apps/runner
uv run openaudit-runner enqueue --model <model id> --eval <slug> --limit 5 --visibility private
uv run openaudit-runner work --run <run id> --exit-when-idle
```

Check the output for the pass or fail warning. Then open the run at `http://localhost:3300/runs/<id>`:

- The results table has the declared metrics, with the correct units and no raw Inspect names.
- The sample pages show the scores with their seed names, and pass and fail the right way round.
  Read one sample of each kind, and check its mark against the transcript.
- The mark at the top of a sample page and the marks under Results agree.

## 6. Fix stored marks

After a change to `attemptName`, `attemptScale`, a direction or a `pass` rule, import the seed
(step 4), then set the marks of stored samples again:

```sh
cd apps/runner
uv run python scripts/repass_attempts.py            # dry run
uv run python scripts/repass_attempts.py --apply    # writes; only with the user's OK
```

A second dry run must show 0 changes.

## 7. Deploy the runner and queue runs (ask the user first)

The Cloudflare containers need a runner image that has the task. Ask the user before a deploy. Then
queue runs for each model with `scripts/queue-model-evals.ts` (`ADD_MODEL.md`, step 7).

## 8. Final checks and commit

```sh
pnpm lint
pnpm test
```

Commit only when the user asks. Add only your files, by path: `data/seed/evals/<slug>.json`, the task
and its test, and the changes to `inspect_map.py`, `tasks.py`, `hazard.py` or `pyproject.toml`. Do
not push.
