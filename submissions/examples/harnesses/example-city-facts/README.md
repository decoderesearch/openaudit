# Example City Facts: run it on your detector

An example of a method evaluation harness submission, made from [`submissions/harnesses/_template`](../../../harnesses/_template). It is complete: pinned data, an eval entry (`seed/`), tests, a lock, and a real baseline run (`baseline-results.json`). It is not an OpenAudit eval, and it does not go on the site.

This folder runs the example eval **Example City Facts 2026-11** on a detector. A detector reads 1,458 short statements about cities and countries from [`L1Fthrasir/Cities-true-false`](https://huggingface.co/datasets/L1Fthrasir/Cities-true-false/tree/077570eabd71e448a7222df8f73d6955e1e05c3f) (at a fixed commit), and must flag the false ones. The headline metric is balanced accuracy. A detector that flags all statements, or none, gets 0.5.

## Summary

We submit a method evaluation harness, as a small example of a complete one. A method evaluation harness is the code that runs an evaluation on a safety method that a person submits: here, a detector of false statements. The eval gives the detector 1,458 short true or false statements about cities, and scores how well it flags the false ones. Asking the model itself got 0.66 on Qwen3-0.6B and 0.91 on Qwen3-4B. Flagging nothing got 0.5, which is chance. It is a toy, so it does not go on the site.

## Steps

You need [uv](https://docs.astral.sh/uv/). A GPU is optional: `examples/ask_model.py` also runs on a CPU, more slowly.

```bash
cd submissions/examples/harnesses/example-city-facts
./run.sh --detector examples/ask_model.py --model Qwen/Qwen3-0.6B --limit 50 --out out/smoke   # smoke run
./run.sh --detector my_detector.py --model Qwen/Qwen3-0.6B --out out/my-detector              # full run
```

`run.sh` installs the pinned packages of `run.py.lock`. Each run adds the subject model to `out/<name>/results.json`, with the sha256 of your detector file. A new run of a model replaces the old one.

- `--limit N`: only the first N statements. Do not submit a run with `--limit`.

## Your detector

Give `--detector` a `.py` file with `load_detector(model_name)`. It gives an object with `threshold` and `score(text)`: `text` is one statement, and a score above the threshold flags it as false. The detector loads the subject model itself, if it needs it. See `examples/ask_model.py` (it asks the model) and `examples/flag_none.py` (it flags nothing).

### Self-test

```bash
./run.sh --detector examples/ask_model.py --model Qwen/Qwen3-0.6B --out out/ask-model
./run.sh --detector examples/flag_none.py --model Qwen/Qwen3-0.6B --out out/flag-none
```

| Detector       | Model           | Balanced accuracy | Time on one RTX 5090 |
| -------------- | --------------- | ----------------- | -------------------- |
| `ask_model.py` | Qwen/Qwen3-0.6B | 0.660             | 15 seconds           |
| `ask_model.py` | Qwen/Qwen3-4B   | 0.914             | 20 seconds           |
| `flag_none.py` | Qwen/Qwen3-0.6B | 0.500             | 1 second             |

On another GPU, a score can differ by about 0.01 (the scores are from an RTX PRO 6000; on an RTX 5090, `ask_model.py` on Qwen3-0.6B gave 0.667).

## Rules

Do not train or tune your detector on these statements, and do not choose its threshold on them. Use other true/false data, for example [`L1Fthrasir/Facts-true-false`](https://huggingface.co/datasets/L1Fthrasir/Facts-true-false).

## Output

`out/<name>/`:

- `results.json`: schema `openaudit.example-city-facts.results/1`. For each subject model: the tier, the detector file and its sha256, the harness commit, the data, and the metrics of each eval.
- `scores.jsonl`: the score of each statement, its label (1: false) and if it is flagged.

## Submit

See [`submission/README.md`](submission/README.md): the template and the steps.

## What happens after you submit

Your numbers do not go on the site. If the detector looks good, we run it again with this harness, and only our run goes on the site. You pay for your own runs. We pay for ours.
