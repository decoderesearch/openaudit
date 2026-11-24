# Sparse autoencoder evals: run them on your SAE

This folder runs the OpenAudit SAE evals on a sparse autoencoder (SAE) that you trained. There are two suites:

- **SynthSAEBench-16k (16k-v1)**: a synthetic model with 16,384 known true features ([paper](https://arxiv.org/abs/2602.14687)). The headline is **MCC**: how well the SAE's decoder matches the true features. It runs in a few minutes on one GPU. ICA Lens is its baseline (see [Baselines](#baselines)).
- **SAEBench (2025-01)**: [SAEBench](https://github.com/adamkarvonen/SAEBench) evals of an SAE on a real model, `blocks.<layer>.hook_resid_post`: core (reconstruction), sparse probing, absorption, SCR, TPP and RAVEL. The subject models are Gemma-2-2B (layer 12) and Pythia-160M-deduped (layer 8).

You do not need to run all of them: one subject model is enough. Each suite uses the settings of the published results on our site, so your numbers can go next to them.

## Leaderboard

<!-- leaderboard:start -->

### [SAEBench Core](https://openaudit.com/evaluations/sae-bench-core) 2025-01

Loss recovered (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.999 | 2      |
| 2        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.999 | 2      |
| 3        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.999 | 2      |
| 4        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.999 | 2      |
| 5        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.999 | 2      |
| 6        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.997 | 2      |
| 7        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.995 | 2      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 1.000 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 1.000 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench Sparse Probing](https://openaudit.com/evaluations/sae-bench-sparse-probing) 2025-01

Top-1 latent accuracy (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.805 | 2      |
| 2        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.802 | 2      |
| 3        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.801 | 2      |
| 4        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.799 | 2      |
| 5        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.788 | 2      |
| 6        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.784 | 2      |
| 7        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.783 | 2      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.737 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.658 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench Feature Absorption](https://openaudit.com/evaluations/sae-bench-absorption) 2025-01

Absorption rate (lower is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.044 | 2      |
| 2        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.046 | 2      |
| 3        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.054 | 2      |
| 4        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.058 | 2      |
| 5        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.060 | 2      |
| 6        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.068 | 2      |
| 7        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.084 | 2      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.006 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.029 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench SCR](https://openaudit.com/evaluations/sae-bench-scr) 2025-01

SCR (top 20 latents) (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.391 | 2      |
| 2        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.375 | 2      |
| 3        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.369 | 2      |
| 4        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.364 | 2      |
| 5        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.345 | 2      |
| 6        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.342 | 2      |
| 7        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.274 | 2      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.106 | 1      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.038 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench TPP](https://openaudit.com/evaluations/sae-bench-tpp) 2025-01

TPP (top 20 latents) (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.346 | 2      |
| 2        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.344 | 2      |
| 3        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.340 | 2      |
| 4        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.255 | 2      |
| 5        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.246 | 2      |
| 6        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.238 | 2      |
| 7        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.099 | 2      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.016 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.005 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench RAVEL](https://openaudit.com/evaluations/sae-bench-ravel) 2025-03

Disentanglement (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.776 | 1      |
| 2        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.755 | 1      |
| 3        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.753 | 1      |
| 4        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.752 | 1      |
| 5        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.751 | 1      |
| 6        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.749 | 1      |
| 7        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.746 | 1      |
| Baseline | [MDAS (Supervised)](https://openaudit.com/methods/sparse-autoencoders/mdas)                    | Sparse Autoencoders | 0.866 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.702 | 1      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.699 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench Unlearning](https://openaudit.com/evaluations/sae-bench-unlearning) 2025-01

Unlearning score (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.203 | 1      |
| 2        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.195 | 1      |
| 3        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.163 | 1      |
| 4        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.154 | 1      |
| 5        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.133 | 1      |
| 6        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.126 | 1      |
| 7        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.116 | 1      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.000 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.000 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SAEBench AutoInterp](https://openaudit.com/evaluations/sae-bench-autointerp) 2025-01

AutoInterp score (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.892 | 2      |
| 2        | [TopK](https://openaudit.com/methods/sparse-autoencoders/topk)                                 | Sparse Autoencoders | 0.890 | 2      |
| 3        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.889 | 2      |
| 4        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.887 | 2      |
| 5        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.869 | 2      |
| 6        | [Gated](https://openaudit.com/methods/sparse-autoencoders/gated)                               | Sparse Autoencoders | 0.868 | 2      |
| 7        | [P-Anneal](https://openaudit.com/methods/sparse-autoencoders/p-anneal)                         | Sparse Autoencoders | 0.862 | 2      |
| Baseline | [PCA](https://openaudit.com/methods/sparse-autoencoders/pca)                                   | Sparse Autoencoders | 0.671 | 1      |
| Baseline | [Raw Activations](https://openaudit.com/methods/sparse-autoencoders/raw-activations)           | Sparse Autoencoders | 0.656 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

### [SynthSAEBench-16k](https://openaudit.com/evaluations/synth-sae-bench-16k) 16k-v1

Feature match (MCC) (higher is better), the median over the models with a result.

| Rank     | Variant                                                                                        | Method              | Score | Models |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------- | ----- | ------ |
| 1        | [Matryoshka BatchTopK](https://openaudit.com/methods/sparse-autoencoders/matryoshka-batchtopk) | Sparse Autoencoders | 0.795 | 1      |
| 2        | [BatchTopK](https://openaudit.com/methods/sparse-autoencoders/batchtopk)                       | Sparse Autoencoders | 0.764 | 1      |
| 3        | [JumpReLU](https://openaudit.com/methods/sparse-autoencoders/jumprelu)                         | Sparse Autoencoders | 0.756 | 1      |
| 4        | [Matching Pursuit](https://openaudit.com/methods/sparse-autoencoders/matching-pursuit)         | Sparse Autoencoders | 0.715 | 1      |
| 5        | [ReLU](https://openaudit.com/methods/sparse-autoencoders/relu)                                 | Sparse Autoencoders | 0.651 | 1      |
| Baseline | [ICA Lens](https://openaudit.com/methods/sparse-autoencoders/ica-lens)                         | Sparse Autoencoders | 0.638 | 1      |

A variant with more than one artifact on a model shows its best one. The site also compares them at matched settings.

Our runs and published results, 2026-11-20. The site is the source of truth: it has each model, each variant and their samples. Generated by `submissions/leaderboards.mjs` from `leaderboard.json`.

<!-- leaderboard:end -->

## Steps

You need [uv](https://docs.astral.sh/uv/) and an NVIDIA GPU. Gemma-2-2B needs about 24 GB. Gemma is a gated model: accept its license on Hugging Face and log in with `hf auth login`.

```bash
cd evals/sparse-autoencoders
./run.sh synth --sae examples/synth_published_sae.py --out out/btk --samples 10000    # smoke run

./setup.sh                                                                             # once: SAEBench and its venv
./run.sh saebench --sae examples/saebench_published_sae.py \
  --model EleutherAI/pythia-160m-deduped --out out/topk-4k --smoke                     # smoke run
./run.sh saebench --sae my_sae.py --model google/gemma-2-2b --out out/my-sae           # full run
```

- `synth` installs the pinned packages of `synth.py.lock` (SAELens 6.37.0).
- `saebench` uses the venv of `setup.sh`: SAEBench at a pinned commit, with the pinned packages of `saebench-requirements.txt` (SAELens 5.5.2, torch 2.7.1 for CUDA 12.8).

Each run adds the subject model to `out/<name>/results.json`, with the sha256 of your SAE file. If you run the same SAE file again on the same model, the harness keeps the evals of both runs. So you can run one eval at a time with `--evals`.

### SAEBench options

- `--evals core,sparse_probing`: only these evals. The default is core, sparse_probing, absorption, scr, tpp, and ravel on Gemma.
- `unlearning`: Gemma only. It needs the WMDP bio forget corpus at `.saebench/sae_bench/evals/unlearning/data/bio-forget-corpus.jsonl` ([request access](https://huggingface.co/datasets/cais/wmdp-bio-forget-corpus)).
- `autointerp`: it needs `OPENAI_API_KEY`. It calls gpt-4o-mini, which is a paid API.
- `--smoke`: a short core run, to test your SAE file. Do not submit it.

A full Pythia run takes about 1 hour on an RTX 5090. Gemma takes longer.

## Your SAE

Give `--sae` a `.py` file. Your function loads the weights from a fixed commit.

- **synth**: `load_sae(device)` gives a SAELens SAE (or an object with `encode`, `decode`, `W_dec [d_sae, 768]`, `device` and `dtype`). See `examples/synth_published_sae.py`.
- **saebench**: `load_sae(model, layer, device, dtype)` gives a [`BaseSAE`](https://github.com/adamkarvonen/SAEBench/blob/c681fd875b7a7f8c08b5f9f53bbae69db2dd5661/sae_bench/custom_saes/base_sae.py) for `model` (the Hub name) at `blocks.<layer>.hook_resid_post`. The rows of `W_dec` must have norm 1: move the norms into `W_enc` and `b_enc`. See `examples/saebench_published_sae.py` and SAEBench's `custom_saes/`.

The harness checks the SAE before the run: the shapes, the decoder norms and that encode and decode give finite values.

### Self-test

- **SynthSAEBench**: on the published BatchTopK and standard SAEs, MCC and uniqueness are the same as the published values. These metrics read only the decoder. The other metrics can be a little different: the published values come from the training SAE at the end of training, and the harness evaluates the saved SAE.
- **SAEBench**: on the published Pythia 4k TopK SAE (trainer 2), the full run takes 10 minutes on one RTX 5090. Results against the published values:

| Eval           | Metric                           | Harness | Published   |
| -------------- | -------------------------------- | ------- | ----------- |
| core           | `ce_loss_score`                  | 0.9738  | 0.9738      |
| core           | `explained_variance`             | 0.8420  | 0.8420      |
| core           | `l0`                             | 76.56   | 76.56       |
| scr            | `scr_k20`                        | 0.3324  | 0.3324      |
| tpp            | `tpp_k20`                        | 0.2006  | 0.1998      |
| absorption     | `mean_absorption_fraction_score` | 0.1082  | 0.1060      |
| sparse probing | `sae_top_1_test_accuracy`        | 0.7409  | 0.7465      |
| sparse probing | `llm_top_1_test_accuracy`        | 0.6317  | 0.637–0.651 |

Core is exact. The other evals train probes, so they move a little from run to run. Sparse probing moves the most: the published LLM baseline of the same model and settings goes from 0.637 to 0.651.

```bash
SYNTH_SAE=btk/l0-15/seed-0 ./run.sh synth --sae examples/synth_published_sae.py --out out/btk
./run.sh saebench --sae examples/saebench_published_sae.py --model EleutherAI/pythia-160m-deduped --out out/topk-4k
```

SAEBench's core eval streams `Skylion007/openwebtext`. The harness pins it to its revision of the published runs, because its Parquet version gives other samples.

## Baselines

After your result, the harness prints the rank of your SAE among the published SAEs, then the mean of each baseline (not ranked). The baselines are in `data/seed/methods/sparse-autoencoders.json` with `"baseline": true`.

**ICA Lens** ([paper](https://arxiv.org/abs/2606.11722)) is the baseline on SynthSAEBench. To fit it and run the eval for one fit seed:

```bash
./run.sh icalens --seed 0 --out out/icalens-baseline/seed-0
./run.sh icalens --seed 0 --out out/icalens-smoke --fit-samples 20000 --max-iter 20 --samples 10000   # smoke run
```

1. `icalens/sample.py` takes 1,000,000 samples of the synthetic model with the torch seed 1000 + the fit seed. The eval uses seed 0, so the fit never sees the eval samples.
2. `icalens/fit.py` fits FastICA with `icalens` 0.4.1: all 768 components, no preprocessing, 200 steps, and `random_state` = the fit seed. The tail sign of each component is the sign of the skewness of its scores.
3. `icalens/icalens_sae.py` makes a SAELens `StandardSAE` from the lens with the formula of Neuronpedia's converter. ReLU keeps the long tail of each score. Then the synth eval runs.

`icalens` needs `transformers` 5 and SAELens 6.37.0 needs `transformers` 4, so the fit has its own environment (`icalens/fit.py.lock`). The three steps take about 1 minute on an RTX 5090.

ICA Lens is complete: 768 directions for 768 dimensions. Its MCC is the mean over 768 matched pairs, and an SAE's is over 4,096. Its scores are dense, so its L0 is near 360 and its probing F1 is low.

To import the five seeds: `node data/scripts/fetch-openaudit-icalens.mjs`, then the seed import of `ADD_A_METHOD.md`.

## Rules

Train on data that is not in the eval data: for SynthSAEBench, use your own samples of the synthetic model (any seed). Do not tune on the eval results.

## Output

`out/<name>/`:

- `results.json`: schema `openaudit.sparse-autoencoders.results/1`. For each subject model: the suite, the tier, the SAE file and its sha256, the harness commit, and the metrics of each eval.
- `saebench/<model>/<eval>/`: the SAEBench result files.

## Submit

See [`submission/README.md`](submission/README.md): the template and the steps.

## What happens after you submit

Your numbers do not go on the site. If the SAE looks good, we run it again with this harness, and only our run goes on the site. You pay for your own runs. We pay for ours.
