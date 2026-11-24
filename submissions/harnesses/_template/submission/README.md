# Submit a detector

TEMPLATE: this file tells people how to submit a variant to your harness. Change "detector" to your artifact.

This folder has the template of a detector submission. First read the general steps in [`submissions/README.md`](../../../README.md).

## Steps

1. Run the harness on your detector for each model that you have a detector for. See [`../README.md`](../README.md). Do not use `--limit`.
2. Put the weights, if any, on Hugging Face at a commit.
3. Copy `submission.json` to `submissions/<method>/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder. Put each detector file and its tests (`code/tests/test_<name>.py`) in `code/` in that folder.
4. Run `node submissions/check.mjs`. Then open a pull request.

## submission.json

The general fields are in `submissions/README.md`. For a detector:

- `artifacts`: one detector file for each model. `path` is the file in `code/`, and `sha256` is the output of `sha256sum code/detector.py`.
- `artifacts[].params`: TEMPLATE: the `params` of `rules.json`, and what each one means.

`results.json` must have a full run of each detector file, with the same sha256.
