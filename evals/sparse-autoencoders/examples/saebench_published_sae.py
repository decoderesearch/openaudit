"""An example SAE file for ./run.sh saebench: a published SAEBench SAE, with SAEBench's own loader.

SAEBENCH_SAE is "<Hub repo>:<folder of ae.pt>". The default is a 4k TopK SAE on Pythia-160M:
  ./run.sh saebench --sae examples/saebench_published_sae.py --model EleutherAI/pythia-160m-deduped \
    --out out/topk-4k

Your SAE file needs the same function: load_sae(model, layer, device, dtype) gives a
sae_bench.custom_saes.base_sae.BaseSAE for `model` (a Hub name) at blocks.<layer>.hook_resid_post.
"""

import json
import os

from huggingface_hub import hf_hub_download
from sae_bench.custom_saes.run_all_evals_dictionary_learning_saes import TRAINER_LOADERS

DEFAULT = (
    "adamkarvonen/saebench_pythia-160m-deduped_width-2pow12_date-0108:"
    "TopK_pythia-160m-deduped__0108/resid_post_layer_8/trainer_2"
)


def load_sae(model, layer, device, dtype):
    repo, folder = os.environ.get("SAEBENCH_SAE", DEFAULT).split(":")
    with open(hf_hub_download(repo, f"{folder}/config.json")) as f:
        config = json.load(f)
    trainer = config["trainer"]["trainer_class"]
    # The published TopK results used the threshold.
    extra = {"use_threshold_at_inference": True} if trainer == "TopKTrainer" else {}
    return TRAINER_LOADERS[trainer](
        repo_id=repo,
        filename=f"{folder}/ae.pt",
        model_name=model.split("/")[-1],
        device=device,
        dtype=dtype,
        layer=layer,
        **extra,
    )
