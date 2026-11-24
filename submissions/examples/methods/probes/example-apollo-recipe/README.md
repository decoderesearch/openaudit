# Example: a variant submission

A complete example of a method variant submission, for the Varied Deception harness ([`evals/varied-deception`](../../../../../evals/varied-deception)). It is not a new variant: it is the Apollo-style probe recipe of that harness (`examples/apollo_recipe.py`), with our real full runs.

## Summary

This is an example of the files of a method variant, not a new variant. The variant is the Apollo-style probe recipe of the Varied Deception harness: a lie detector that reads the activations of the model. The harness fits the probe on each model and tests if it flags the lies of that model. We fit it on five models, and it got balanced accuracies from 0.65 to 0.86. Copy the form of these files for your own variant.

## Files

- `submission.json`: the recipe file (`code/recipe.py`, by `path` and sha256), its training data (`trainData`), and the recipe text.
- `code/recipe.py`: the recipe. `code/tests/`: its tests. With `tensors()`, the harness saves each fitted probe as `<model>_probe.safetensors`, and `results.json` gives its sha256 and size (`fit.files`). Do not put these files in the folder: our own run makes the files that the site offers.
- `results.json`: the harness output, a fit of the recipe on 4 of the 9 core models and on Qwen/Qwen3-4B.

Check it:

```bash
node submissions/check.mjs submissions/examples/methods/probes/example-apollo-recipe
node submissions/rank.mjs submissions/examples/methods/probes/example-apollo-recipe/results.json
```

The check gives one warning: the fit covers only some core models, so we fit the recipe on the others before we rank it.
