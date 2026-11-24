# Submit a workspace lens with WorkspaceBench

This folder has the template of a workspace lens submission with WorkspaceBench results. First read the general steps in [`submissions/README.md`](../../../submissions/README.md).

The workspace lens method has two harnesses: this one, and [`evals/workspace-lenses`](../../workspace-lenses). Run one of them. We run the other one on our side.

## Models

WorkspaceBench 2026-11 runs only on `Qwen/Qwen3.6-27B`: the read plan of each question is for that model. Your lens must be for Qwen3.6-27B.

## Steps

1. Run the full tier on your lens. See [`../README.md`](../README.md). Do not use `--limit` or `--families`.
2. Put a `.pt` lens file on Hugging Face. Copy the link to the file at its commit: `https://huggingface.co/<owner>/<repo>/blob/<commit>/<file>`. A `.py` lens goes in `code/` in your submission folder, with its tests (`code/tests/test_<name>.py`), and its weights go on Hugging Face.
3. Copy `submission.json` to `submissions/workspace-lenses/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder.
4. Run `node submissions/check.mjs`. Then open a pull request.

## submission.json

The general fields are in `submissions/README.md`. For a lens:

- `artifacts`: one lens file, for `Qwen/Qwen3.6-27B`. `sha256` is the output of `sha256sum` on the file. For a `.py` lens, give `path` (`code/my_lens.py`) in place of `url`, and the links to its weights in `links`.
- `artifacts[].params`: `fitPrompts` (the number of fit prompts) and `fitData` (the fit dataset).

`results.json` must have a full run of the lens file, with the same sha256.

## The recipe

Tell us about:

- The fit data, and how much of it.
- How you chose the settings, and on which data.
- For a `.pt` lens: the readout that it needs (`norm` or `cosine`).
- If you used WorkspaceBench items. Do not fit your lens or choose its settings on them.
- The script that fits the lens.
