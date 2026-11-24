# Submit a sparse autoencoder

This folder has the template of an SAE submission. First read the general steps in [`submissions/README.md`](../../../submissions/README.md).

## Models

Submit one SAE for each subject model that you ran. You do not need all of them: one model is enough.

- `decoderesearch/synth-sae-bench-16k-v1`: the SynthSAEBench-16k synthetic model. It needs the `synth-sae-bench-16k` eval.
- `google/gemma-2-2b` (layer 12) or `EleutherAI/pythia-160m-deduped` (layer 8): SAEBench. These need core, sparse probing, absorption, SCR and TPP. RAVEL, unlearning and autointerp are optional.

## Steps

1. Run the harness on your SAE for each subject model. See [`../README.md`](../README.md). Do not use `--smoke` or `--samples`.
2. Put the weights on Hugging Face. The SAE file must load them at a fixed commit, as safetensors or with `torch.load(..., weights_only=True)`.
3. Copy `submission.json` to `submissions/sparse-autoencoders/<variant>/` and fill it in. Copy the harness's `results.json` into the same folder. Put each SAE file and its tests (`code/tests/test_<name>.py`) in `code/` in that folder.
4. Run `node submissions/check.mjs`. Then open a pull request.

## submission.json

The general fields are in `submissions/README.md`. For an SAE:

- `artifacts`: one SAE file for each subject model. `path` is the file in `code/`, and `sha256` is the output of `sha256sum code/my_sae.py`.
- `artifacts[].params`: `width`, `targetL0`, `trainData`, `trainingTokens` or `trainingSamples`, `batchSize`, `learningRate`, `seed`, `dtype`, `normalizeActivations` and `prependBos`. Give the ones that apply.

`results.json` must have a full run of each SAE file, with the same sha256.

## The recipe

Tell us about:

- The architecture, and what is new in it.
- The training data, and how much of it.
- How you chose the settings (width, L0, learning rate), and on which data.
- The script that trains the SAE.
