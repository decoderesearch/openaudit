# Tail-8 Probe

> Example: a variant of a method on the site (Probes), with a research log. An AI agent made it in an OpenAudit user test, with a test persona. Check it with `node submissions/check.mjs submissions/examples/methods/probes/example-tail-8-probe`.

An Apollo-style lie probe that reads only the last 8 tokens of the reply. The other probes on OpenAudit score the mean over all reply tokens.

## Summary

We submit a new variant of the Probes method. A probe is a lie detector that reads the activations of the model. This variant reads only the last 8 tokens of the reply, where the model gives its answer, and not the mean over all tokens. We fit it on Qwen3.5-4B with the Varied Deception harness. It got a balanced accuracy of 0.871, and the same probe with the usual readout got 0.864. The gain is in the noise, and the variant has a result on only one of the nine core models.

## The idea

A lie can show most at the end of the reply, where the model states its answer. If so, the mean over all tokens dilutes the signal. This variant tests that idea on Varied Deception.

## What changes

The fit is the same as the harness's Apollo recipe (`evals/varied-deception/examples/apollo_recipe.py`): instructed pairs from `L1Fthrasir/Facts-true-false`, a difference in means and logistic regressions on 8 layers. Only the readout changes. The probe scores the mean of the activations of the last 8 reply tokens. The Alpaca threshold (1% positive rate) and the choice of probe on the validation split use the same readout. `TAIL = 8` was fixed before any run.

## Related work

- Goldowsky-Dill et al. (2025), Appendix D.5: a last-token probe was about as good as the mean.
- Parrack, Attubato and Heimersheim (2025): of many aggregations, the mean over all reply tokens was best.

This variant tests a last-k readout on Varied Deception, which no variant on OpenAudit does.

## Results

A full run on Qwen/Qwen3.5-4B (535 chats: 253 lies, 282 honest), `results.json`:

| Variant                                               | Balanced accuracy | TPR   | TNR   | Layer |
| ----------------------------------------------------- | ----------------- | ----- | ----- | ----- |
| Tail-8 Probe (this recipe)                            | 0.871             | 0.874 | 0.869 | 16    |
| Apollo recipe of the harness (same fit, mean readout) | 0.864             | 0.842 | 0.887 | 19    |

The gain over the same fit with the mean readout is 0.007. With 535 chats, this is in the noise (about ±0.015). The recipe has a result on one of the 9 core models only.

A smoke run on Qwen/Qwen3-4B (`--limit 100`, not submitted) gave 0.601.

## Run it

```bash
cd evals/varied-deception
./run.sh --recipe ../../submissions/examples/methods/probes/example-tail-8-probe/code/recipe.py --model Qwen/Qwen3.5-4B --out out/tail-8-probe
```

The fit saves the probe (`tensors()` in the recipe) as `out/tail-8-probe/Qwen3.5-4B_probe.safetensors`. `results.json` gives its sha256 (`fit.files`).
