"""Run the OpenAudit Workspace Lens evals on your lens. Start it with ./run.sh (see README.md).

It runs the same code as our own runs (data/scripts/rlens-fit) on the pinned jpp_lens commit, and
writes the sample files, the swap tables and results.json to --out. The logit lens runs next to
your lens as the baseline.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import logging
import os
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
RLENS_FIT = REPO / "data" / "scripts" / "rlens-fit"
EXTRACTED = REPO / "data" / "extracted" / "methods" / "openaudit-lens-readout.json"
RESULTS_SCHEMA = "openaudit.workspace-lenses.results/1"
READOUT = ("workspace-lens-readout", "2026-10.3")
SWAP = ("workspace-probe-swap", "2026-11")
SMOKE_MODEL = "Qwen/Qwen3.5-0.8B"
LENS_NAME = "submission"
BASELINE = "logit"

# The paper's seven readout layers of each model on our leaderboard. Other models use
# round(n_layers * i / 8) for i = 1..7, which gives these same layers.
OFFICIAL_LAYERS = {
    "Qwen/Qwen3.6-27B": [8, 16, 24, 32, 40, 48, 56],
    "google/gemma-4-31B": [8, 15, 22, 30, 38, 45, 52],
    "allenai/Olmo-3-1125-32B": [8, 16, 24, 32, 40, 48, 56],
    "Qwen/Qwen3.5-9B": [4, 8, 12, 16, 20, 24, 28],
    "Qwen/Qwen3.5-122B-A10B": [6, 12, 18, 24, 30, 36, 42],
    "deepseek-ai/DeepSeek-V4-Flash": [5, 11, 16, 22, 27, 32, 38],
}

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("workspace-lenses")


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def git(*args: str, cwd: Path) -> str:
    done = subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=False
    )
    # A git error (for example "dubious ownership") must not give a clean run.
    if done.returncode:
        raise SystemExit(f"git {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout.strip()


def readout_layers(model_name: str, n_layers: int) -> list[int]:
    return OFFICIAL_LAYERS.get(model_name) or [
        round(n_layers * i / 8) for i in range(1, 8)
    ]


class PythonLens:
    """Wraps the object of a lens file in Python for the readout runner. An object with `layers`
    runs only at those of the readout layers."""

    def __init__(self, inner, layers: list[int], config) -> None:
        self.inner = inner
        own = set(getattr(inner, "layers", layers))
        self.source_layers = [layer for layer in layers if layer in own]
        self.config = config

    def move_parameters_to_device(self, device) -> None:
        if hasattr(self.inner, "to"):
            self.inner.to(device)

    def transport(self, residual, layer: int):
        return self.inner.transport(residual, layer)


def load_submission_lens(path: Path, model, model_name: str, layers: list[int]):
    """Your lens: a `.pt` file in the J format, or a `.py` file with `load_lens`."""
    from workspace_lens.config import LensConfig
    from workspace_lens.utils import check_model_matches_config, load_lens_file

    if path.suffix == ".py":
        spec = importlib.util.spec_from_file_location("submission_lens", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not hasattr(module, "load_lens"):
            raise SystemExit(
                f"{path} has no load_lens(model, layers, hf_model_name) function"
            )
        config = LensConfig(
            hf_model_name=model_name,
            checkpoint_name=path.stem,
            lens_type="logit",
            d_model=model.d_model,
        )
        return PythonLens(module.load_lens(model, layers, model_name), layers, config)
    lens = load_lens_file(str(path), hf_model_name=model_name)
    check_model_matches_config(model, lens.config)
    return lens


def check_transport(lens, model, layers: list[int]) -> None:
    """Fails early if the lens does not map [..., d_model] to [..., d_model] with finite values."""
    import torch as t
    from workspace_lens.utils import model_device_of

    lens.move_parameters_to_device(model_device_of(model))
    x = t.randn(2, 3, model.d_model, device=model_device_of(model))
    for layer in layers:
        y = lens.transport(x, layer)
        if tuple(y.shape) != tuple(x.shape):
            raise SystemExit(
                f"transport at layer {layer}: shape {tuple(y.shape)}, not {tuple(x.shape)}"
            )
        if not t.isfinite(y).all():
            raise SystemExit(f"transport at layer {layer}: values that are not finite")


def correctness_csv_for(model, model_name: str, out: Path) -> tuple[Path, str]:
    """Our grade file of the model if we have one, else a new grade of the eval items."""
    from lens_evals.readout_evals.readout_eval_items import (
        MACRO_EVALS,
        load_readout_eval_items,
    )
    from lens_evals.readout_evals.readout_evals import ReadoutEvalRunner

    slug = model_name.split("/")[-1]
    ours = HERE / "correctness" / f"{slug}.csv"
    if ours.exists():
        return ours, "openaudit"
    path = out / f"{slug}_correctness.csv"
    if not path.exists():
        logger.info("no grade file of %s: grading the eval items", model_name)
        layers = readout_layers(model_name, model.n_layers)
        runner = ReadoutEvalRunner(model, {}, layers=layers, max_seq_len=512)
        items = load_readout_eval_items(slugs=MACRO_EVALS)
        df = runner.grade_model_correctness(items, hf_model_name=model_name)
        df.to_csv(path, index=False)
    return path, "this run"


def leaderboard(
    model_name: str, metrics: dict, metric: str, eval_key: tuple[str, str]
) -> None:
    """Prints where the lens would be among our results on this model."""
    if not EXTRACTED.exists():
        return
    rows = []
    for a in json.loads(EXTRACTED.read_text())["artifacts"]:
        if a["subject"] != model_name:
            continue
        for r in a["results"]:
            if (r["eval"], r["version"]) == eval_key and metric in r["metrics"]:
                rows.append((r["metrics"][metric], a["variant"]))
    if not rows:
        return
    rows.append((metrics[metric], "<- your lens"))
    rows.sort(key=lambda r: -r[0])
    print(f"\n{eval_key[0]} {eval_key[1]}, {metric}, {model_name}:")
    for value, name in rows:
        print(f"  {value:.3f}  {name}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--lens", required=True, help="a .pt file (J format) or a .py file"
    )
    parser.add_argument(
        "--model", default=SMOKE_MODEL, help="HF model, default %(default)s"
    )
    parser.add_argument("--out", required=True, help="output folder")
    parser.add_argument(
        "--tier",
        choices=["smoke", "full"],
        default=None,
        help="smoke: a check that it runs; full: the scores. Default: smoke on the smoke model",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="only the first N readout items"
    )
    parser.add_argument(
        "--skip-swap", action="store_true", help="do not run the probe swap eval"
    )
    parser.add_argument(
        "--device-map", default=None, help="e.g. 'auto' for more than one GPU"
    )
    parser.add_argument("--attn-implementation", default="sdpa")
    parser.add_argument("--experts-implementation", default=None)
    parser.add_argument("--dequantize-fp8", action="store_true", help="for DeepSeek-V4")
    args = parser.parse_args()

    lens_path = Path(args.lens).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    tier = args.tier or ("smoke" if args.model == SMOKE_MODEL else "full")
    jpp_dir = Path(os.environ["JPP_DIR"]).resolve()
    os.chdir(jpp_dir)
    sys.path[:0] = [str(jpp_dir / "scripts"), str(RLENS_FIT), str(HERE)]

    import scoring
    import torch as t
    from jpp_cli import LOGIT_LENS_SPEC, load_lenses
    from probe_swap import write_swaps
    from readout_samples import write_samples
    from workspace_lens import get_hf_model
    from workspace_lens.lenses.jacobian_lens import JacobianLens

    start = time.time()
    model = get_hf_model(
        args.model,
        attn_implementation=args.attn_implementation,
        device_map=args.device_map,
        experts_implementation=args.experts_implementation,
        dequantize_fp8=args.dequantize_fp8,
    )
    readout = readout_layers(args.model, model.n_layers)
    logger.info("%s: %d layers, readout layers %s", args.model, model.n_layers, readout)
    lens = load_submission_lens(lens_path, model, args.model, readout)
    # Your lens and the baseline use the readout layers that your lens has.
    layers = [layer for layer in readout if layer in set(lens.source_layers)]
    if not layers:
        raise SystemExit(f"{lens_path.name} has none of the readout layers {readout}")
    if layers != readout:
        logger.info(
            "your lens has readout layers %s: the baseline uses the same", layers
        )
    check_transport(lens, model, layers)
    lenses = {LENS_NAME: lens}
    lenses |= load_lenses(
        [LOGIT_LENS_SPEC], model, hf_model_name=args.model, layers=layers
    )
    correctness, graded_by = correctness_csv_for(model, args.model, out)
    slug = args.model.split("/")[-1]
    lens_files = [lens_path.name, LOGIT_LENS_SPEC]

    samples = out / f"{slug}_readout_samples.jsonl.gz"
    write_samples(
        model,
        lenses,
        layers,
        model_name=args.model,
        correctness_csv=str(correctness),
        out_path=str(samples),
        lens_files=lens_files,
        strip_word_answers=True,
        limit=args.limit,
    )
    header, items = scoring.read_samples(samples)
    by_lens = scoring.readout_recall(header, items, layers)
    evals = {
        READOUT[0]: {
            "version": READOUT[1],
            "metrics": scoring.readout_metrics(by_lens[LENS_NAME]),
            "baseline": scoring.readout_metrics(by_lens[BASELINE]),
            "files": [samples.name],
        }
    }

    if args.skip_swap:
        logger.info("probe swap: skipped (--skip-swap)")
    elif not isinstance(lens, JacobianLens):
        logger.info("probe swap: skipped, it needs a linear lens (a .pt file)")
    else:
        write_swaps(
            model,
            lenses,
            layers,
            model_name=args.model,
            lens_files=lens_files,
            scales=[0.5, 1.0, 2.0, 4.0],
            out_dir=out,
            strip_word_answers=True,
        )
        swaps = scoring.swap_metrics(out / f"{slug}_probe_swap_success.csv")
        evals[SWAP[0]] = {
            "version": SWAP[1],
            "metrics": swaps[LENS_NAME],
            "baseline": swaps[BASELINE],
            "files": [f"{slug}_probe_swap_{n}" for n in ("success.csv", "header.json")],
        }

    run = {
        "model": args.model,
        "tier": tier,
        "partial": bool(args.limit),
        "lens": {"file": lens_path.name, "sha256": sha256_of(lens_path)},
        "harness": {
            "openaudit": git("rev-parse", "HEAD", cwd=REPO),
            "openauditDirty": bool(
                git("status", "--porcelain", "--", str(HERE), str(RLENS_FIT), cwd=REPO)
            ),
            "jppLens": git("rev-parse", "HEAD", cwd=jpp_dir),
        },
        "layers": layers,
        "readoutLayers": readout,
        "correctness": {"file": correctness.name, "gradedBy": graded_by},
        "evals": evals,
        "seconds": round(time.time() - start),
        "gpus": [t.cuda.get_device_name(i) for i in range(t.cuda.device_count())],
        "torch": t.__version__,
        "date": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    results_path = out / "results.json"
    results = json.loads(results_path.read_text()) if results_path.exists() else {}
    results["schema"] = RESULTS_SCHEMA
    results.setdefault("runs", {})[args.model] = run
    results_path.write_text(json.dumps(results, indent=2) + "\n")

    for key, version in (READOUT, SWAP):
        if key not in evals:
            continue
        metric = "recall_at_10" if key == READOUT[0] else "swap_top1"
        e = evals[key]
        print(
            f"\n{key} {version}: {metric} {e['metrics'][metric]:.3f} (logit lens {e['baseline'][metric]:.3f})"
        )
        leaderboard(args.model, e["metrics"], metric, (key, version))
    print(f"\nwrote {results_path}")
    if tier == "smoke":
        print(
            "smoke tier: this checks that the run works. The scores of a small model are not results."
        )
    if args.limit:
        print(f"--limit {args.limit}: a partial run. Do not submit it.")


if __name__ == "__main__":
    main()
