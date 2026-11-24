# Submit a model evaluation

Use this folder to submit an evaluation that OpenAudit can run on models. Each submission is one folder, `submissions/evals/<slug>/`, in a pull request. Copy an example in `submissions/examples/evals/`: [`example-code-review-sycophancy`](../examples/evals/example-code-review-sycophancy) (a `new` eval), [`example-sycophancy-eval`](../examples/evals/example-sycophancy-eval) (an Inspect Evals task, with its known errors) or [`example-or-bench`](../examples/evals/example-or-bench) (a `port`, with a parity test).

We run evaluations with [Inspect](https://inspect.aisi.org.uk/). There are three kinds of submission:

| `kind`          | You have                                                                                                | You send                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `inspect_evals` | An evaluation that is in the [Inspect Evals](https://github.com/UKGovernmentBEIS/inspect_evals) package | `eval.json`, with the task name and the Inspect Evals release                                 |
| `port`          | An evaluation with its own code, not in the package (also an Inspect Evals register entry)              | `eval.json`, the Inspect task (`task.py`), tests, and a parity test (`parity.json`)           |
| `new`           | A new evaluation                                                                                        | `eval.json`, the Inspect task (`task.py`), tests, and how its items stay out of training data |

## Steps

1. For `port` and `new`, put the dataset on Hugging Face. Each item of the evaluation must come from it, at one commit. Keep the repo private while you work. It must be public before we merge, so that we can run it (a gated repo with automatic access is good). A held-out split stays gated (see `contamination` below). You can pilot steps 2 to 6 on a local file first (`json_dataset("items.jsonl")`), and upload when the items are correct. For `inspect_evals`, give the source that the task loads: its Hugging Face repo and commit, or a `url`. Do not upload the data of other authors.
2. Write the task, if your kind is `port` or `new`: `task.py`, with one `@task` function named as the slug with `_` in place of `-` (`my-eval` is `my_eval`). Load the data with `hf_dataset(..., revision=<commit>)`.
3. Write `tests/test_<name>.py`. Test the parts that need no model and no download: the parser, the samples and the scorer.
4. Write `eval.json` and `submission.json` (see below).
5. Check the files, and run the task on a few samples with Inspect's mock model. From the repo root:

   ```sh
   node submissions/check.mjs submissions/evals/<slug>
   cd apps/runner
   uv run pytest ../../submissions/evals/<slug>/tests
   uv run python ../../submissions/check_eval_task.py ../../submissions/evals/<slug>
   ```

   The check needs the spec packages (`pnpm install --filter @openaudit/spec-tools --prod --ignore-scripts`; skip it after a full `pnpm install`, as it removes the dev packages). The mock run costs nothing. The first `uv run` in `apps/runner` installs all of the runner's packages (about 2 GB). If you have less space, make a small environment at the runner's versions (about 500 MB), and use `.venv-eval/bin/python` in place of `uv run python`:

   ```sh
   cd apps/runner
   uv export --no-hashes --no-emit-workspace -q > /tmp/constraints.txt
   uv venv .venv-eval
   uv pip install -p .venv-eval inspect-ai datasets pytest openai -c /tmp/constraints.txt
   ```

6. Run the task on a real model, with a small limit first:

   ```sh
   uv run inspect eval ../../submissions/evals/<slug>/task.py --model openrouter/<model> --limit 20 --sample-shuffle 42
   ```

   `--sample-shuffle 42` takes samples from all of the dataset, not only its first rows, with the seed 42. Do not use 0 or 1: Inspect reads 1 as "true", a shuffle with no seed, and each model gets different samples. If the task has a `shuffle` argument, also add `-T shuffle=false`, so that each model gets the same samples. Read some samples in `inspect view`. Check that the scorer marks them correctly, and that most replies give an answer that the scorer can read. With a reasoning model, check that the scorer reads only the reply (`.text`), not the reasoning (`.content`). The reasoning also uses the token limit: if the task sets a low limit, look for empty replies. A mock run cannot find these problems.

   If a run shows an error in your own items (a wrong label, a broken item), fix the dataset at a new commit and run again. If the runs cost too much, keep them and list the error in the README. Do not change or remove an item because a model fails it.

7. Write `README.md`, with a [summary](../README.md#the-summary) first. Put the same summary at the top of the pull request, and open it.

## The files

### `eval.json`

The evaluation, in the same format as our seed (`data/seed/evals/*.json`, schema `Eval` and `EvalVersion` in `spec/schemas/eval.yaml`), with exactly one version:

- `eval`: the slug, the name, a description and a one-sentence summary, the maintainers, links, access, status and facets. The slug and the names must be new on the site. Use `status: active`. If the scorer has known errors, list them in your README: we choose the status when we review.
- `versions[0].dataset`: `hfRepo`, `revision` (a 40-character commit), `license` and the splits. For `inspect_evals`, a `url` in place of `hfRepo` and `revision` is good.
- `versions[0].scores`: one entry for each value that the scorer gives each sample. The first scorer's name must be the score's `key` (or set `attemptName`). If the scorer gives a dict, give an entry for each value: we mark each sample by the score that the headline metric names in its `score`. Give each score a `direction`. We use it to mark each sample pass or fail, so check it against the paper.
- `versions[0].metrics`: the numbers of a run. Give each one a `direction` and a `safetyDirection` (which value is safer), and mark one as the `headline`.
- `versions[0].runner`: `kind: "inspect"`, the task, `defaultLimit` (the samples of a full run), the roles, and a slot for each judge or auditor model. A slot's `default` is the task's own default model, as a route id with no `openrouter/` (`openai/gpt-6-luna`). A slot names a `tier` from `spec/model-ladders.yaml`, not only a model: we run the judge at that tier, also when the task's own default judge is the target model. For your own runs, a cheap model of that tier is good. For `port` and `new`, the task is `openaudit_runner/<name>`, where your task goes when we accept it. For `inspect_evals`, it is `inspect_evals/<name>`, and `package` is the release, `inspect-evals==<x.y.z>`.

### `submission.json`

- `schema`: `"openaudit.eval-submission/1"`.
- `slug`: the folder name.
- `kind`: `inspect_evals`, `port` or `new`.
- `authors`, `contact`, `license`, `links`: who made it, an email for our questions, the license of your files (the dataset's license goes in `eval.json`), and the paper and code.
- `metricKeys`: maps the Inspect name of a metric, `<scorer>/<metric>`, to its key in `eval.json`, for example `{"judge/catch_rate": "catch_rate"}`. Add an entry only when the two names are different. `check_eval_task.py` warns about each Inspect name that is not a metric of `eval.json`.
- `contamination` (required for `new`): how the items stay out of training data. Use a canary string in each item, and a gated repo. We recommend a held-out split too: about a quarter of the items, not in the public dataset, in a second Hugging Face repo that is gated with manual approval. Give access only to the user `neuronpedia-org` (ours), and give the repo and its commit here. We run it to find contamination; the site shows only the public items.
- `original` (required for `port`): `repo` and `commit` of the code that you ported.
- `runs` (optional): your finished runs, as Inspect `.eval` logs on Hugging Face: `model`, `log` (the file at a commit) and `sha256`. Runs on small models are good too. We use them only to check our runs. A log holds all the items and replies, and the paths of your computer: remove the paths, and use a gated repo, so that web crawls do not get the items.
- `researchLog` (optional): a link to your prompts or your agent's log, with private information removed. Or put the log in `research-log.md` in the folder. Add it only if you agree to share it.

### `parity.json` (for `port`)

Run the original code and your port on the same samples (at least 20) with the same model, and compare:

```json
{
  "model": "openai/gpt-5-mini",
  "samples": 50,
  "metrics": { "<headline metric key>": { "original": 0.62, "port": 0.6 } },
  "sampleAgreement": 0.94,
  "notes": "What is different from the original, and why."
}
```

If the original's judge model is too expensive or no longer available, use one other judge for both, and say so in `notes`. To find scorer errors, also give the same replies to both scorers.

`sampleAgreement` (optional) is the share of samples with the same score in both. A gap of more than 0.05 on the headline metric gives a warning: say why in `notes`.

### Other files

`README.md`, with a [summary](../README.md#the-summary) first. Optional: `research-log.md`, more `.py` files that `task.py` imports, and `tests/`. No other files: put datasets and logs on Hugging Face. Each file can be at most 1 MB.

## What happens next

1. We read the submission, the task and the tests. We check that the scores measure what the evaluation says, and that the samples cannot leak the answers.
2. We copy your task into `apps/runner/openaudit_runner/`, add `eval.json` to our seed, and run the evaluation on our models, at our cost.
3. Only our runs go on the site. Your runs are a check. A later change is a new pull request and a new version.

How we run submitted code: [`SECURITY.md`](../SECURITY.md).
