# My Eval: run it on your detector

TEMPLATE: this README is for the people who run your method evaluation harness on their artifacts. Keep the parts with `##`: the check needs Steps, Rules, Output and Submit. Copy the style of a harness in [`evals/`](../../../evals), for example [`evals/varied-deception`](../../../evals/varied-deception/README.md).

This folder runs the OpenAudit **My Eval 2026-11** eval on a detector that you made. TEMPLATE: what the eval tests, on which data (link it, at its pinned revision), and the headline metric. Say what chance is.

## Summary

TEMPLATE: 3 to 6 plain sentences, 30 to 150 words, for the person who reviews your submission. See [the summary](../../README.md#the-summary).

## Steps

You need [uv](https://docs.astral.sh/uv/). TEMPLATE: the GPU, if your eval needs one.

```bash
cd submissions/harnesses/my-harness
./run.sh --detector examples/flag_none.py --model Qwen/Qwen3-4B --limit 50 --out out/smoke    # smoke run
./run.sh --detector my_detector.py --model Qwen/Qwen3-4B --out out/my-detector                # full run
```

`run.sh` installs the pinned packages of `run.py.lock`. Each run adds the subject model to `out/<name>/results.json`, with the sha256 of your detector file. A new run of a model replaces the old one.

- `--limit N`: only the first N items. Do not submit a run with `--limit`.

## Your detector

Give `--detector` a `.py` file with `load_detector(model_name)`. It gives an object with `threshold` and `score(text)`: a score above the threshold flags the item. See `examples/flag_none.py`.

TEMPLATE: the full interface: the inputs (text, chats, activations at which layers and tokens), the outputs, and what "no score" means.

### Self-test

TEMPLATE: the command and the scores of a known artifact, so that a person can check their setup. For example:

```bash
./run.sh --detector examples/flag_none.py --model Qwen/Qwen3-4B --out out/flag-none
```

`flag_none.py` gets a balanced accuracy of 0.5.

## Rules

Do not train or tune your detector on the eval items, and do not choose its threshold on them. TEMPLATE: the data that people can use (a train or validation split), and how the harness enforces the rules.

## Output

`out/<name>/`:

- `results.json`: schema `openaudit.my-harness.results/1`. For each subject model: the tier, the detector file and its sha256, the harness commit, the data, and the metrics of each eval.
- `scores.jsonl`: the score of each item, its label and if it is flagged.

## Submit

See [`submission/README.md`](submission/README.md): the template and the steps.

## What happens after you submit

Your numbers do not go on the site. If the detector looks good, we run it again with this harness, and only our run goes on the site. You pay for your own runs. We pay for ours.
