# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "sae-lens==6.37.0",
#   "torch==2.14.1",
# ]
# ///
"""Run the OpenAudit SynthSAEBench-16k eval on your SAE. Start it with ./run.sh synth (see
README.md).

It loads the pinned SynthSAEBench-16k synthetic model, and scores your SAE against the model's true
features with SAELens's eval_sae_on_synthetic_data, as the SynthSAEBench paper's runs did: 1,000,000
samples in batches of 1,024. Writes results.json to --out.
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import common

SUBJECT = "decoderesearch/synth-sae-bench-16k-v1"
REVISION = "f99b414f298dad50a4aa704bf9c6d7670ddc800c"
EVAL = ("synth-sae-bench-16k", "16k-v1")
SAMPLES = 1_000_000
BATCH = 1024
SEED = 0


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--sae", required=True, help="a .py file with load_sae(device)")
    parser.add_argument("--out", required=True, help="output folder")
    parser.add_argument(
        "--samples", type=int, default=SAMPLES, help="fewer samples: a smoke run"
    )
    args = parser.parse_args()

    import torch
    from huggingface_hub import snapshot_download
    from sae_lens.synthetic.evals import eval_sae_on_synthetic_data
    from sae_lens.synthetic.synthetic_model import SyntheticModel

    start = time.time()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    path = Path(args.sae).resolve()
    model = SyntheticModel.load_from_disk(
        snapshot_download(SUBJECT, revision=REVISION), device=device
    )
    sae = common.load_module(path, "submission_sae").load_sae(device)
    d_model = model.feature_dict.feature_vectors.shape[-1]
    common.check_sae(sae, d_model, device)

    torch.manual_seed(SEED)
    r = eval_sae_on_synthetic_data(
        sae=sae,
        feature_dict=model.feature_dict,
        activations_generator=model.activation_generator,
        num_samples=args.samples,
        batch_size=BATCH,
    )
    metrics = {
        "mcc": r.mcc,
        "f1_score": r.classification.f1_score,
        "precision": r.classification.precision,
        "recall": r.classification.recall,
        "explained_variance": r.explained_variance,
        "l0": r.sae_l0,
        "dead_latents": r.dead_latents,
        "shrinkage": r.shrinkage,
        "uniqueness": r.uniqueness,
    }
    partial = args.samples != SAMPLES
    common.write_run(
        Path(args.out),
        SUBJECT,
        {
            "suite": "synth",
            "tier": "smoke" if partial else "full",
            "partial": partial,
            "sae": {"file": path.name, "sha256": common.sha256_of(path)},
            "sites": [],
            "harness": common.harness_info(HERE)
            | {"model": {"repo": SUBJECT, "revision": REVISION}},
            "evals": {
                EVAL[0]: {
                    "version": EVAL[1],
                    "metrics": metrics,
                    "samples": args.samples,
                    "seed": SEED,
                }
            },
            "seconds": round(time.time() - start),
            "gpus": common.gpus(),
            "torch": torch.__version__,
        },
    )
    print(f"\n{EVAL[0]} {EVAL[1]}:")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}" if isinstance(v, float) else f"  {k}: {v}")
    common.leaderboard(SUBJECT, EVAL[0], "mcc", metrics["mcc"])
    if partial:
        print(f"--samples {args.samples}: a smoke run. Do not submit it.")


if __name__ == "__main__":
    main()
