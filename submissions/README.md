# Submit a method variant

To submit a model evaluation, see [`evals/README.md`](evals/README.md). To submit a method evaluation harness, see [`harnesses/README.md`](harnesses/README.md).

Use this folder to submit a new variant of a method, for example a new workspace lens or a new probe. Each submission is one folder, `submissions/<method>/<variant>/`, in a pull request.

## Methods with a method evaluation harness

A method evaluation harness (here, a harness) is our code that runs our evals on your variant, with the same code as our runs. Each harness has a `submission/` folder with its template and its own steps:

| Method                                          | Harness                                                     | Template and steps                                                                |
| ----------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `workspace-lenses`                              | [`evals/workspace-lenses`](../evals/workspace-lenses)       | [`evals/workspace-lenses/submission`](../evals/workspace-lenses/submission)       |
| `workspace-lenses`                              | [`evals/workspacebench`](../evals/workspacebench)           | [`evals/workspacebench/submission`](../evals/workspacebench/submission)           |
| `probes`, `llm-monitors`, `logprob-classifiers` | [`evals/varied-deception`](../evals/varied-deception)       | [`evals/varied-deception/submission`](../evals/varied-deception/submission)       |
| `sparse-autoencoders`                           | [`evals/sparse-autoencoders`](../evals/sparse-autoencoders) | [`evals/sparse-autoencoders/submission`](../evals/sparse-autoencoders/submission) |

For a method with two harnesses, run one of them and send its `results.json`. We run the other one on our side.

For a new method that a harness can run, see [A new method](#a-new-method). For other methods, use the Submit form on the site (openaudit.com, at the top right). Send a link to your code or weights, the results that you have, and the recipe.

## Steps

1. Run the harness on your variant. You do not need to run all of our models: one model is enough. For workspace lenses, a lens on other models is also good. The other harnesses only have data for their own models. Varied Deception ranks on its core models, so run one of them; we fit your recipe on the others.
2. Put large files, such as weights, on Hugging Face. Link to each file at a commit.
3. Copy the harness's `submission/submission.json` to `submissions/<method>/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder. Put your code (`.py` files) in `code/` in the same folder.
4. Write `README.md`, with a [summary](#the-summary) first.
5. Run `node submissions/check.mjs`. Then open a pull request.

A complete example, with code, tests and real runs: [`examples/methods/probes/example-apollo-recipe`](examples/methods/probes/example-apollo-recipe). Other examples: a small change to a recipe, with a research log ([`example-tail-8-probe`](examples/methods/probes/example-tail-8-probe)), and a new method with a recipe that has no training data ([`paraphrase-consistency`](examples/methods/paraphrase-consistency)).

To see where your results would rank before you submit, run `node submissions/rank.mjs <your results.json>`. It compares them with the harness's `leaderboard.json`. It is a preview: only our run goes on the site.

## The files

`submission.json`:

- `method`: the method slug. It is also the parent folder name.
- `variant`: the slug of your variant (lowercase letters, digits and hyphens). It is also the folder name.
- `displayName`, `summary`: the name on the site, and what your variant does that the others do not.
- `authors`, `contact`, `license`, `links`: who made it, an email for our questions, the license of your files, and the paper and code (`paper`, `repo`, `blog`, `homepage`, `dataset`).
- `artifacts`: one file for each model, with its sha256 and its params. A `.py` file gives its `path` in `code/`; a weights file gives its Hugging Face `url` at a commit. The harness's `submission/README.md` tells which params. For a harness that fits a recipe (Varied Deception), artifacts are optional.
- `recipe` (optional): how you made the variant. See below.

`results.json`: the output of the harness.

`README.md`: the [summary](#the-summary) first. Then, if you want, more about your variant.

`research-log.md` (optional): the research log of your AI agent, if you agree to share it.

`code/` (for code): the `.py` files of your variant, and their tests in `code/tests/test_<name>.py`. We review the code in the pull request. It runs in the harness's environment, so it cannot add packages: if you need one, ask in the pull request. Load weights as safetensors or with `torch.load(..., weights_only=True)`. To run the tests with the harness's packages (`<harness>` is the folder in `evals/`). The command makes a temporary environment with the packages that the harness's `run.py` pins, and runs pytest in it:

```bash
uv run --no-project --with pytest \
  --with-requirements <(uv export --script evals/<harness>/run.py --no-hashes -q) \
  pytest submissions/<method>/<variant>/code/tests
```

The first time, it downloads the harness's packages (about 6 GB on disk for Varied Deception, with torch). The tests need no GPU. A skipped test is not a pass: if pytest says "skipped", the packages are missing.

Do not put weights or other large files in the folder. The check stops at 1 MB for each file.

## The summary

The `README.md` of each submission starts with `## Summary`: 3 to 6 plain sentences (30 to 150 words). The reviewer reads it first. Tell:

- what you submit: a method variant, a new method, a model evaluation or a method evaluation harness;
- what it does or tests, and why that is important;
- what you ran it on;
- what you found, in words, with only the numbers that matter most;
- the main limit.

Do not put a table, a list or code in it, and explain each term that a reader may not know. Put the same text at the top of the pull request. The checks find a summary that is missing, too short or too long. For example, see the summary of [`example-tail-8-probe`](examples/methods/probes/example-tail-8-probe/README.md).

## The recipe

The recipe is optional, but it helps us a lot. A variant that is fit or tuned on the eval items can get a high score that does not generalize. The recipe tells us that your variant did not. With its script, we can also fit your variant on our models. Its keys:

- `summary`: how you made the variant, in a few sentences.
- `fitData`: the data that you fit or trained on, and how much of it.
- `selection`: how you chose the settings, and on which data.
- `evalItemsUsed`: `none`, or the items of our evals that you used, and how. The harness's `submission/README.md` tells which items you can use.
- `script`: the script or the commit that makes the variant.
- `compute`: the GPUs and the time.

A harness that fits a recipe (Varied Deception) also takes `file`, the recipe file in `code/` (`path`) with its sha256, and `trainData`, the data of the fit. Then the recipe is required for a rank. See the harness's `submission/README.md`.

## A new method

A harness runs a kind of file, not only one method. For example, `evals/varied-deception` runs any lie detector, and `evals/sparse-autoencoders` runs any SAE. If a harness can run your new method, submit the method with its first variant:

1. Write `submissions/<method>/method.json`: the method's entry, as the `method` part of a file in [`data/seed/methods/`](../data/seed/methods). It needs `slug` (the folder name), `displayName`, `group` (`white_box` or `black_box`), `summary`, `safetyUse`, `caveats`, `params` (the settings of its variants), `compare` (`{ "groupBy": [] }` is good) and `links`. The schema is `Method` in [`spec/schemas/method.yaml`](../spec/schemas/method.yaml).
2. Make the first variant in `submissions/<method>/<variant>/`, with the steps above. Its `submission.json` also has `harness`: the harness folder that ran it, for example `"varied-deception"`. The params of your method are also params of its variants.
3. Run `node submissions/check.mjs`. It checks `method.json` too (it needs `pnpm install --filter @openaudit/spec-tools --prod --ignore-scripts` first; skip that after a full `pnpm install`, as it removes the dev packages). Then open a pull request.

## What happens next

1. We read the submission and the recipe.
2. If it looks good, we run the harness on your files on our hardware, at our cost. If your files are not on our models, we can fit your variant on them with your recipe.
3. Only our run goes on the site, with `resultsBy: OpenAudit`, next to our runs of the other variants. Your `results.json` is a check: it does not go on the site.

The site shows the variant only after our run. Each run of yours is at your cost. How we run submitted code: [`SECURITY.md`](SECURITY.md).
