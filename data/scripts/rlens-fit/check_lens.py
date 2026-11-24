"""Check a pooled R-Lens file (or a Neuronpedia-format lens) before it is used.

Prints the file's config, the worst fp16 relative error (Neuronpedia stores the
maps in fp16 and allows 2e-3), and a readout test: at sample layers, how often
the top-1 token of the lens readout and of the logit lens matches the model's
final top-1 token. A working lens matches more often than the logit lens.

Usage (from the jpp_lens root):
  uv run --extra cu128 python check_lens.py --lens <pooled.pt> \
    --prompts-json /workspace/rlens/fit_prompts.json
"""

import argparse
import json
import sys
from pathlib import Path

sys.modules["fla"] = None

import torch as t

MAX_FP16_REL_ERR = 2e-3


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lens", required=True)
    parser.add_argument("--prompts-json", required=True)
    parser.add_argument(
        "--prompt-range", default="56:64", help="python slice of the prompts"
    )
    parser.add_argument(
        "--layers", default=None, help="sample layers; default: 7 spread out"
    )
    parser.add_argument("--skip-model", action="store_true", help="only check the file")
    parser.add_argument(
        "--hf-model-name", default=None, help="for a Neuronpedia-format lens"
    )
    parser.add_argument(
        "--device-map",
        default=None,
        help="e.g. 'auto' for a model on more than one GPU",
    )
    args = parser.parse_args()

    raw = t.load(args.lens, map_location="cpu", mmap=True, weights_only=False)
    if "config" in raw:
        config = raw["config"]
        jacobians = {int(k): v for k, v in raw["parameters"]["jacobians"].items()}
    else:
        if not args.hf_model_name:
            raise SystemExit("a Neuronpedia-format lens needs --hf-model-name")
        config = {
            "hf_model_name": args.hf_model_name,
            "num_prompts_trained_on": raw.get("n_prompts"),
        }
        jacobians = {int(k): v for k, v in raw["J"].items()}
    layers_all = sorted(jacobians)
    print(
        json.dumps(
            {
                k: config.get(k)
                for k in (
                    "hf_model_name",
                    "lrp_mode",
                    "num_prompts_trained_on",
                    "max_seq_len",
                    "skip_first_n_positions",
                    "relative_end_transport_layer",
                    "jacobian_rows_per_pass",
                    "d_model",
                )
            }
        )
    )
    print(f"layers {layers_all[0]}..{layers_all[-1]} ({len(layers_all)})")
    worst = 0.0
    for layer, jac in jacobians.items():
        full = jac.float()
        if not t.isfinite(full).all():
            raise SystemExit(f"layer {layer} is not finite")
        half = full.half()
        if not t.isfinite(half).all():
            raise SystemExit(f"layer {layer} overflows fp16")
        worst = max(worst, ((half.float() - full).norm() / full.norm()).item())
    status = "ok" if worst <= MAX_FP16_REL_ERR else "ABOVE LIMIT"
    print(f"fp16 max relative error {worst:.2e} ({status})")
    if args.skip_model:
        return

    from workspace_lens import get_hf_model

    model = get_hf_model(
        config["hf_model_name"], attn_implementation="sdpa", device_map=args.device_map
    )
    n = len(layers_all)
    sample = (
        [int(x) for x in args.layers.split(",")]
        if args.layers
        else sorted({round(i * (n - 1) / 6) for i in range(7)})
    )
    start, stop = (int(x) for x in args.prompt_range.split(":"))
    prompts = json.loads(Path(args.prompts_json).read_text())[start:stop]
    skip = int(config.get("skip_first_n_positions", 16))

    captured: dict[int, t.Tensor] = {}

    def hook(idx):
        def fn(_module, _inputs, output):
            captured[idx] = output[0] if isinstance(output, tuple) else output

        return fn

    handles = [model.layers[i].register_forward_hook(hook(i)) for i in [*sample, n]]
    hits = {layer: {"logit": 0, "rlens": 0} for layer in sample}
    total = 0
    with t.no_grad():
        for prompt in prompts:
            captured.clear()
            model.forward(
                model.encode(prompt, max_length=int(config.get("max_seq_len", 128)))
            )
            final = model.unembed(captured[n][0, skip:]).argmax(-1)
            total += final.numel()
            for layer in sample:
                h = captured[layer][0, skip:].to(captured[n].device)
                J = jacobians[layer].to(h.device, t.float32)
                logit = model.unembed(h).argmax(-1)
                rlens = model.unembed((h.float() @ J.T).to(h.dtype)).argmax(-1)
                hits[layer]["logit"] += (logit == final).sum().item()
                hits[layer]["rlens"] += (rlens == final).sum().item()
    for handle in handles:
        handle.remove()
    print(f"top-1 match with the final output over {total} positions:")
    for layer in sample:
        h = hits[layer]
        print(
            f"  layer {layer:3d}  logit {h['logit'] / total:.3f}  rlens {h['rlens'] / total:.3f}"
        )


if __name__ == "__main__":
    main()
