# Submit a method evaluation harness

A method evaluation scores safety methods (lenses, SAEs, probes, monitors), not models. To run it on many variants, we need a **method evaluation harness** (here, a harness): code that runs the eval on a file that a person submits (a lens, an SAE, a detector) and writes `results.json`. A model evaluation needs no harness of this kind: [Inspect](https://inspect.aisi.org.uk/) runs it. People then submit variants to your harness, as for the harnesses in [`evals/`](../../evals).

Send a new harness as a pull request with one folder, `submissions/harnesses/<harness>/`. Start from [`_template/`](_template). [`examples/harnesses/example-city-facts`](../examples/harnesses/example-city-facts) is the template, filled in, with a real baseline run: it runs in less than a minute. [`example-multilingual-deception`](../examples/harnesses/example-multilingual-deception) is a larger one, with a data script, but its data is not on Hugging Face. Our harnesses in `evals/` are larger examples: [`varied-deception`](../../evals/varied-deception) is a good one to copy.

## Before you start

- The method must be on the site (`data/seed/methods/`). For a new method, first suggest it with the [How to Contribute](https://openaudit.com/contribute#new-methods) page, or send it with its first variant ("A new method" in [`../README.md`](../README.md#a-new-method)).
- Look at the method evaluations on the site. If your eval is close to one of them, tell us in the pull request how it is different.
- If a harness in `evals/` already runs the same kind of file (lie detectors: `varied-deception`), use its artifact interface. Then its variants can run on your harness too. Copy its loader from its `run.py` (for lie detectors: `load_detector` and `kind_of`), not the simpler interface of the template.
- With no GPU, you can still send a harness: do the baseline run with a detector that needs no GPU, such as an LLM monitor through an API or a control such as text length. After we accept the harness, we run the GPU methods, such as probes.
- Check the license of each dataset that you use or change. Your data's license must agree with it.

## The folder

| File                         | What it is                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                  | A [summary](../README.md#the-summary) for the reviewer. Then, for the people who run the harness: Steps, the artifact interface, Self-test, Rules, Output and Submit |
| `run.sh`                     | Runs the eval on one artifact and one subject model, with the pinned packages                                                                                        |
| `setup.sh`                   | Optional: gets other code, at a commit                                                                                                                               |
| `run.py`, `scoring.py`, ...  | The harness code. Keep the scoring in its own file, so that the tests need no GPU                                                                                    |
| `run.py.lock`                | The pinned packages (`uv lock --script run.py`), or a requirements file with `--hash`                                                                                |
| `tests/test_<harness>.py`    | Tests of the scoring, with no GPU and no download                                                                                                                    |
| `examples/`                  | At least one artifact for the self-test, for example a simple baseline                                                                                               |
| `submission/rules.json`      | The rules of a submission to your harness (below)                                                                                                                    |
| `submission/submission.json` | The template of a variant submission                                                                                                                                 |
| `submission/README.md`       | The steps to submit a variant                                                                                                                                        |
| `seed/<eval>.json`           | The eval entry of each new eval (below)                                                                                                                              |
| `baseline-results.json`      | The `results.json` of a full run on a known artifact (below)                                                                                                         |

Only text files, each at most 1 MB (a lock file at most 5 MB). Put data and weights on Hugging Face, at a commit.

## The rules of a harness

- **Pin all of it.** The data on Hugging Face at a 40-character commit, with the sha256 of each file. The packages in a lock. Other repos at a commit. No branches, tags or "latest". Then our run uses the same code and data as yours. The dataset can be private while you work: `huggingface_hub` reads your token from `HF_TOKEN` or `hf auth login`. It must be public before we merge, so that we can run it. Before the upload, you can test on a local copy of the data, but the baseline run must use the pinned data.
- **Make the data again.** If you made the data with a script (for example, replies of each subject model), put the script in the folder, so that we can make data for more models. We run it with our own API keys, at our cost. If the script gets the replies of an open model through an API, say which provider: it can serve other weights or settings than the model on Hugging Face.
- **Use paths in the folder only.** When we accept the harness, we move it to `evals/<harness>/`. Our harnesses in `evals/` can import `data/scripts/`; yours cannot.
- **Keep the eval items apart.** Give people the data that they can train and tune on (a train or validation split), and keep the eval items out of it. If you can, make the harness check it, as Varied Deception does.
- **Hide the label.** The detector must not see the answer: no system prompt that asks for a lie, no label in an ID, a file name or the metadata. Varied Deception gives the detector the chat without the system prompt (`visible()` in its `run.py`). Add a test for it.
- **No secrets.** Read API keys from the environment, and never write them to the output.
- **Record the run.** Each run in `results.json` has the sha256 of the artifact and the repo commit, so that we can check a submission against our run.

## results.json

One object, with `schema` (`openaudit.<harness>.results/1`) and `runs`, keyed by the subject model. Each run has:

- `tier`: `"full"`, or `"smoke"` for a run with `--limit`. `partial`: `true` for a run with `--limit`.
- `<artifact>`: `file` and `sha256` of the submitted file. The key is `artifact` in `rules.json`.
- `harness`: `openaudit` (the repo commit) and `openauditDirty` (the folder had local changes).
- `evals`: for each eval slug, `version` and `metrics` (from 0 to 1, unless `unitMetrics` is `false`).

Add other data as you need it: the time, the GPU, the data revision. `run.py` in the template writes this form.

## submission/rules.json

- `methods`: the method slugs that the harness takes. `artifact`: what a person submits, in lowercase (`"detector"`).
- `results`: the `schema` of `results.json`. `params`: the names of the settings of an artifact (can be empty).
- `evals`: each eval slug to its version.
- `models`: the subject models of the leaderboard. `anyModel: false`: only these models.
- Optional: `optional` (evals that a run can leave out, for example one that only some artifacts can run), `required` (the evals that a model needs, if not all), `unitMetrics: false`, and `fit` with `coreModels` (the harness fits a recipe on each core model, as Varied Deception does).

## The eval entry

For each new eval, add `seed/<eval slug>.json` in the format of `data/seed/evals/` (schema `Eval` and `EvalVersion` in [`spec/schemas/eval.yaml`](../../spec/schemas/eval.yaml)). Copy a similar entry, for example `data/seed/evals/varied-deception.json` or the example's [`seed/`](../examples/harnesses/example-city-facts/seed). Put the authors in `maintainers` (leave out `url` if there is none), and the data's license in the version's dataset. Give a contact email in the pull request. It needs:

- `facets.subjects: ["method"]`, the topics (or `[]` for a method benchmark), and a summary and a description: what it tests, on which models, how it scores, and its known limits.
- One version, with the version of `rules.json`: the dataset (at a commit) and the metrics, each with `direction` and a `description`. Mark one metric as the `headline`: the site ranks on it.

## The baseline run

Run your harness without `--limit` on a known artifact: a variant of the method that is on the site, or a simple baseline in `examples/`. Commit the folder first (a local commit is enough), so that the run has `openauditDirty: false`. Copy its `results.json` to `baseline-results.json`. If a known artifact scores near the top (or a simple control, such as text length, scores well), the eval cannot rank strong methods: write it in the known limits, and think about harder items. Give the command, the scores and how much a score can differ on another GPU in the README ("Self-test"), so that a person can check their setup against them.

## Check it

From the repo root:

```sh
pnpm install --filter @openaudit/spec-tools --prod --ignore-scripts  # skip after a full pnpm install
node submissions/check-harness.mjs submissions/harnesses/<harness>
uv run --no-project --with pytest pytest submissions/harnesses/<harness>/tests
```

The tests need only pytest. If they need the harness's packages, add `--with-requirements <(uv export --script submissions/harnesses/<harness>/run.py --no-hashes -q)`. The check does not run the harness. Until you pin the data and do the baseline run, it gives errors for them; fix the other errors first, at no cost. Then open a pull request. Tell us the GPU and the time of a full run.

## What happens next

1. We read the code, run the tests and run the harness on your baseline. We check that the scores agree with `baseline-results.json`.
2. We move the folder to `evals/<harness>/`, add the eval entries to the site, and run the harness on the method's variants, at our cost.
3. People can then submit variants to your harness. Only our runs go on the site.

How we run submitted code: [`SECURITY.md`](../SECURITY.md).
