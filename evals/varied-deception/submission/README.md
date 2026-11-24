# Submit a lie detector

This folder has the template of a lie detector submission: a probe, an LLM monitor or a logprob classifier. First read the general steps in [`submissions/README.md`](../../../submissions/README.md).

## Methods

Set `method` to the method of your detector, and put the folder in `submissions/<method>/<variant>/`:

- `probes`: it reads the subject model's activations.
- `logprob-classifiers`: it asks the subject model follow-up questions and reads the probabilities of its answers.
- `llm-monitors`: a second model reads the chat.
- A new method: its slug, with `method.json` and `harness: "varied-deception"` ("A new method" in [`../../../submissions/README.md`](../../../submissions/README.md)).

## A recipe or detector files

A probe is specific to one model. Thus a variant is a **recipe**: a file that fits the probe on any subject model (see "Your recipe" in [`../README.md`](../README.md)). We use your recipe to fit the probe on each core model, and we rank only a variant with a recipe.

You can also give detector files that you fit yourself (`artifacts`). Then the run on each of their models is a run of that file. A method that does not train (a monitor) uses a recipe with `TRAIN_DATA = {"kind": "none"}`, whose `fit_detector` only makes the detector. It needs no GPU unless it reads activations, and we rank it as other recipes.

## Models

The leaderboard ranks on the 9 core models (`coreModels` in `rules.json`). You do not need to run all of them: a run on one small core model is enough. We fit the recipe on the others before we rank it.

## Steps

1. Put each data file of `TRAIN_DATA` on Hugging Face, at a commit (not for `"kind": "none"`).
2. Run the harness with `--recipe` on one or more core models. See [`../README.md`](../README.md). Do not use `--limit`.
3. Copy `submission.json` to `submissions/<method>/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder. Put your recipe file, its tests (`code/tests/test_<name>.py`) and any detector `.py` files in `code/` in that folder.
4. Run `node submissions/check.mjs`. Then open a pull request.

## submission.json

The general fields are in `submissions/README.md`. For a detector:

- `recipe.file`: the `path` of the recipe file (`code/recipe.py`), and its `sha256` (the output of `sha256sum code/recipe.py`). The fit records the sha256 of this file only, so put all the code of the recipe in it.
- `recipe.trainData`: a copy of the recipe's `TRAIN_DATA`. It must be the same as in each fit of `results.json`.
- `artifacts`: optional. A detector file for a model, with its `sha256`: a `path` in `code/` for a `.py` file, else a Hugging Face `url` at a commit.
- `artifacts[].params`: `layers` (for a probe), `trainData` (the training data) and `judgeModel` (for a monitor).

Each run in `results.json` must be a full fit of the recipe file, with the same sha256, or a full run of the artifact of that model.

## The recipe

Also tell us, in text:

- The training data, and how much of it (`fitData`).
- How the recipe chooses the settings (layers, threshold, prompts), and on which data (`selection`).
- If you used the Varied Deception chats, and how (`evalItemsUsed`). Do not train on the eval chats or choose the threshold on them. You can use the validation split.
- The time of a fit, and on which GPU (`compute`).
