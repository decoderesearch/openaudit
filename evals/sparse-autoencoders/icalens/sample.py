# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "sae-lens==6.37.0",
#   "torch==2.14.1",
#   "safetensors",
# ]
# ///
"""Samples the fit activations of an ICA Lens from the SynthSAEBench-16k model. Fit seed S uses
the torch seed 1000 + S, so the fit samples are never the eval samples (seed 0).
Writes --out: a safetensors file with `acts` [N, 768] float32."""

import argparse
import time

import torch
from huggingface_hub import snapshot_download
from sae_lens.synthetic.synthetic_model import SyntheticModel
from safetensors.torch import save_file

SUBJECT = "decoderesearch/synth-sae-bench-16k-v1"
REVISION = "f99b414f298dad50a4aa704bf9c6d7670ddc800c"
BATCH = 1024


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--n", type=int, default=1_000_000)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    start = time.time()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = SyntheticModel.load_from_disk(
        snapshot_download(SUBJECT, revision=REVISION), device=device
    )
    torch.manual_seed(1000 + args.seed)
    with torch.no_grad():
        acts = torch.cat(
            [
                model.sample(min(BATCH, args.n - i)).float().cpu()
                for i in range(0, args.n, BATCH)
            ]
        )
    save_file({"acts": acts.contiguous()}, args.out)
    print(
        f"sampled {tuple(acts.shape)} with seed {1000 + args.seed} in {time.time() - start:.0f}s"
    )


if __name__ == "__main__":
    main()
