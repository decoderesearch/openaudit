# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "icalens==0.4.1",
#   "torch==2.14.1",
#   "safetensors",
# ]
# ///
"""Fits an ICA Lens on the activations of sample.py, with the icalens defaults except the steps:
no input preprocessing, all 768 components, and FastICA random_state = the fit seed.
Writes --out: the icalens artifact, plus signs.json with the tail sign of each component. The sign
is the sign of the skewness of its scores on the first 200,000 fit samples (the icalens profile
rule), so ReLU keeps the long tail."""

import argparse
import json
import time
from pathlib import Path

import torch
from icalens import ICALens
from safetensors.torch import load_file

SUBJECT = "decoderesearch/synth-sae-bench-16k-v1"
SIGN_SAMPLES = 200_000


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--acts", required=True)
    p.add_argument("--seed", type=int, required=True)
    p.add_argument("--max-iter", type=int, default=200)
    p.add_argument("--out", required=True)
    args = p.parse_args()

    acts = load_file(args.acts)["acts"]
    device = "cuda" if torch.cuda.is_available() else "cpu"
    start = time.time()
    lens = ICALens(model_id=SUBJECT, icalens_preprocessing="none")
    lens.fit(
        acts,
        layer=0,
        max_iter=args.max_iter,
        random_state=args.seed,
        device=device,
        progress=True,
    )
    seconds = time.time() - start
    out = Path(lens.save(args.out))

    with torch.no_grad():
        s = lens.transform(acts[:SIGN_SAMPLES].to(device), layer=0)
        z = (s - s.mean(0)) / s.std(0)
        skew = (z**3).mean(0)
    signs = torch.where(skew >= 0, 1.0, -1.0)
    (out / "signs.json").write_text(
        json.dumps(
            {
                "rule": "sign of score skewness",
                "samples": SIGN_SAMPLES,
                "signs": signs.tolist(),
            }
        )
    )
    print(f"fit {tuple(acts.shape)} in {seconds:.0f}s; wrote {out}")


if __name__ == "__main__":
    main()
