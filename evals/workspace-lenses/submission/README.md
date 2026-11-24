# Submit a workspace lens

This folder has the template of a workspace lens submission. First read the general steps in [`submissions/README.md`](../../../submissions/README.md).

## Models

You do not need to run all of our models. A lens on one model is a good submission.

- **Our leaderboard models** (the list in [`../README.md`](../README.md)): we can rank your lens next to our lenses.
- **Other models**: also a good submission. The harness runs on most Hugging Face models. If your lens looks promising, we can fit it on our models. For that, give the recipe and its script.

## Steps

1. Run the harness on your lens for each model that you have a lens for. See [`../README.md`](../README.md). Do not use `--limit`.
2. Put each `.pt` lens file on Hugging Face. Copy the link to the file at its commit: `https://huggingface.co/<owner>/<repo>/blob/<commit>/<file>`. A `.py` lens goes in `code/` in your submission folder, with its tests (`code/tests/test_<name>.py`), and its weights go on Hugging Face.
3. Copy `submission.json` to `submissions/workspace-lenses/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder.
4. Run `node submissions/check.mjs`. Then open a pull request.

## submission.json

The general fields are in `submissions/README.md`. For a lens:

- `artifacts`: one lens file for each model. `model` is the Hugging Face model ID. `sha256` is the output of `sha256sum lens.pt`.
- `artifacts[].params`: `fitPrompts` (the number of fit prompts) and `fitData` (the fit dataset).

`results.json` must have a full run of each lens file, with the same sha256.

## The recipe

Tell us about:

- The fit data, and how much of it.
- How you chose the settings (layers, rank, scales, steps), and on which data.
- If you used items of our evals, and which. You can use the fit split of the readout eval. Do not use the held-out items or the probe swap items.
- The script that fits the lens. We use it to fit your lens on our models.
