"""Writes an identity lens in the J format, the format of a linear lens file:

    {"J": {layer: Tensor[d_model, d_model]}, "source_layers": [...], "d_model": int,
     "n_prompts": int}

transport(h, layer) = J[layer] @ h. With J = I it reads out the same as the logit lens on both
evals, so a run of this file checks the harness on your machine:

    uv run --project .jpp_lens --extra cu128 python examples/make_identity_j.py \
      --d-model 1024 --layers 3,6,9,12,15,18,21 --out out/identity.pt
    ./run.sh --lens out/identity.pt --out out/identity
"""

import argparse

import torch as t


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--d-model", type=int, required=True)
    parser.add_argument("--layers", required=True, help="e.g. 3,6,9,12,15,18,21")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    layers = [int(x) for x in args.layers.split(",")]
    eye = t.eye(args.d_model)
    t.save(
        {
            "J": {layer: eye.clone() for layer in layers},
            "source_layers": layers,
            "d_model": args.d_model,
            "n_prompts": 0,
        },
        args.out,
    )


if __name__ == "__main__":
    main()
