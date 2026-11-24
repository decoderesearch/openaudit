"""Time the R-Lens fit at several --jacobian-rows-per-pass values on one GPU.

A prompt costs one forward pass (the prompt copied `rows` times) and
ceil(d_model / rows) backward passes. For each value, this times a few backward
passes, estimates the time per prompt, and records the peak GPU memory. A value
that runs out of memory is recorded and skipped.

Usage (from the jpp_lens root):
  uv run --extra cu128 python bench_rows.py --hf-model-name google/gemma-4-31B \
    --prompts-json /workspace/rlens/fit_prompts.json --out bench.json
"""

import argparse
import gc
import json
import math
import sys
import time
from pathlib import Path

sys.modules["fla"] = None  # LRP surgery needs the torch GatedDeltaNet path

import torch as t


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hf-model-name", required=True)
    parser.add_argument("--prompts-json", required=True)
    parser.add_argument("--rows", default="8,16,32,64,128")
    parser.add_argument("--passes", type=int, default=12, help="timed passes per value")
    parser.add_argument("--warmup-passes", type=int, default=2)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    sys.path.insert(0, "scripts")
    from jpp_cli import fit_router
    from workspace_lens import get_hf_model
    from workspace_lens.config import LensConfig
    from workspace_lens.fitting.relp_fitting import ExpertJacobianRelPTrainer

    prompts = json.loads(Path(args.prompts_json).read_text())[:2]
    t0 = time.perf_counter()
    model = get_hf_model(args.hf_model_name, attn_implementation="sdpa")
    load_s = time.perf_counter() - t0
    layers = list(range(model.n_layers - 1))
    weights_gb = t.cuda.memory_allocated() / 1e9
    print(
        f"loaded in {load_s:.0f}s, {weights_gb:.1f} GB, d_model {model.d_model}",
        flush=True,
    )

    router = fit_router(
        model,
        prompts,
        layers=layers,
        num_clusters=1,
        projection_dim=64,
        skip_first_n_positions=16,
        max_seq_len=128,
    )
    config = LensConfig(
        hf_model_name=args.hf_model_name,
        checkpoint_name="bench",
        source_layers=layers,
        relative_end_transport_layer=-1,
        max_seq_len=128,
        skip_first_n_positions=16,
        lrp_mode="rlens",
    )
    trainer = ExpertJacobianRelPTrainer(
        config, model, prompts, router_collections_K_dict={1: router}
    )

    results = []
    for rows in [int(r) for r in args.rows.split(",")]:
        trainer.config.jacobian_rows_per_pass = rows
        total_passes = math.ceil(model.d_model / rows)
        warm = min(args.warmup_passes, total_passes - 1)
        timed = max(1, min(args.passes, total_passes - warm))
        marks: dict[str, float] = {}
        full_passes = trainer._backward_passes.__func__

        def limited(
            forward_state, _full=full_passes, _marks=marks, _warm=warm, _timed=timed
        ):
            t.cuda.synchronize()
            _marks["forward_end"] = time.perf_counter()
            for i, item in enumerate(_full(trainer, forward_state)):
                if i == _warm:
                    t.cuda.synchronize()
                    _marks["timed_start"] = time.perf_counter()
                if i == _warm + _timed:
                    break
                yield item

        trainer._backward_passes = limited
        gc.collect()
        t.cuda.empty_cache()
        t.cuda.reset_peak_memory_stats()
        row = {"rows": rows, "passes_per_prompt": total_passes}
        try:
            start = time.perf_counter()
            trainer.fit_step(prompts[0])
            t.cuda.synchronize()
            end = time.perf_counter()
            pass_s = (end - marks["timed_start"]) / timed
            forward_s = marks["forward_end"] - start
            row |= {
                "forward_s": round(forward_s, 2),
                "pass_s": round(pass_s, 3),
                "est_prompt_min": round((forward_s + pass_s * total_passes) / 60, 2),
                "peak_gb": round(t.cuda.max_memory_allocated() / 1e9, 1),
            }
        except t.OutOfMemoryError:
            row |= {
                "oom": True,
                "peak_gb": round(t.cuda.max_memory_allocated() / 1e9, 1),
            }
        del trainer._backward_passes
        print(json.dumps(row), flush=True)
        results.append(row)
        if row.get("oom"):
            break

    out = {
        "hf_model_name": args.hf_model_name,
        "gpu": t.cuda.get_device_name(0),
        "gpu_total_gb": round(t.cuda.get_device_properties(0).total_memory / 1e9, 1),
        "weights_gb": round(weights_gb, 1),
        "load_s": round(load_s),
        "d_model": model.d_model,
        "n_source_layers": len(layers),
        "results": results,
    }
    Path(args.out).write_text(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
