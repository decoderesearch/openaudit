"""Run the jpp_lens probe-swap eval for one model, with its two controls, and keep every trial.

The harness CLI (`jpp_cli.py probe-swap`) runs only the `main` trials. This script also runs the
`answer_swap` ceiling (swap the answer itself) and the `random_null` control (swap to an unrelated
word). Each trial runs alone, so the `main` rows are the same as the CLI's.

Writes, in --out-dir:
  <slug>_probe_swap_trials.parquet   one row for each trial, lens and scale (all three variants)
  <slug>_probe_swap_success.csv      top-1 and top-5 counts per variant, lens and scale
  <slug>_probe_swap_best_scale.csv   the main trials at each lens's best top-1 scale (the paper's)
  <slug>_probe_swap_header.json      the model, layers, lens files, scales, GPU and run time

Usage (from the jpp_lens root):
  uv run --extra cu128 python probe_swap.py --model Qwen/Qwen3.6-27B --layers 8,16,24,32,40,48,56 \
    --lens a.pt b.pt logit --out-dir out
"""

import argparse
import dataclasses
import json
import logging
import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import torch as t

sys.path.insert(0, "scripts")

from jpp_cli import load_lenses
from lens_evals.causal_evals.probe_swap import (
    PROBE_SWAP_PATH,
    PROBE_SWAP_SCALES,
    best_scale_rows,
    load_probe_swap_trials,
    probe_swap_formatting_token_ids,
    probe_swap_success_table,
    slice_lens_to_layers,
)
from lens_evals.causal_evals.runner import SwapEvalRunner
from strip_rule import fixed_prompt
from workspace_lens import get_hf_model
from workspace_lens.lenses.jacobian_lens import JacobianLens
from workspace_lens.utils import check_model_matches_config

MAX_SEQ_LEN = 512
VARIANTS = ("main", "answer_swap", "random_null")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("probe_swap")


def success_by_variant(trials: pd.DataFrame) -> pd.DataFrame:
    """The harness's success table for each variant. Its eligibility and hit rules apply to the
    rows labelled `main`, so each variant is scored as if it were `main`."""
    tables = []
    for variant in VARIANTS:
        rows = trials[trials["variant"] == variant].assign(variant="main")
        table = probe_swap_success_table(rows)
        tables.append(table.assign(variant=variant))
    return pd.concat(tables, ignore_index=True)


def with_strip_rule(tokenizer, trials: list) -> list:
    """`trials` with the rule of strip_rule.py on each prompt. Each item's answer and swap answer
    must both start after the prompt it gives."""
    items = {i["name"]: i for i in json.loads(Path(PROBE_SWAP_PATH).read_text())["items"]}
    prompts = {
        name: fixed_prompt(tokenizer, i["prompt"], [i["answer"], i["swap_answer"]])
        for name, i in items.items()
    }
    return [dataclasses.replace(trial, prompt=prompts[trial.name]) for trial in trials]


def run_trials(model, lenses, trials, layers, scales):
    """`run_probe_swap` of the harness, on the given trials."""
    sliced = {
        name: slice_lens_to_layers(lens, layers) if isinstance(lens, JacobianLens) else lens
        for name, lens in lenses.items()
    }
    runner = SwapEvalRunner(
        model,
        sliced,
        band_layers=layers,
        scales=scales,
        max_seq_len=MAX_SEQ_LEN,
        formatting_token_ids=probe_swap_formatting_token_ids(model),
    )
    return runner.run(trials), list(runner.dropped_concepts)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--layers", required=True, help="the band layers, e.g. the readout layers")
    parser.add_argument("--lens", nargs="+", required=True)
    parser.add_argument(
        "--scales", default=",".join(str(s) for s in PROBE_SWAP_SCALES), help="edit scales"
    )
    parser.add_argument("--out-dir", required=True)
    parser.add_argument(
        "--strip-word-answers",
        action="store_true",
        help="read without the prompt's trailing space unless the answer is a number (strip_rule.py)",
    )
    parser.add_argument("--device-map", default=None)
    parser.add_argument("--attn-implementation", default="sdpa")
    parser.add_argument("--experts-implementation", default=None)
    args = parser.parse_args()
    layers = [int(x) for x in args.layers.split(",")]
    scales = [float(x) for x in args.scales.split(",")]
    out = Path(args.out_dir)

    start = time.time()
    model = get_hf_model(
        args.model,
        attn_implementation=args.attn_implementation,
        device_map=args.device_map,
        experts_implementation=args.experts_implementation,
    )
    lenses = load_lenses(args.lens, model, hf_model_name=args.model, layers=layers)
    for lens in lenses.values():
        check_model_matches_config(model, lens.config)
    loaded = time.time()
    logger.info("model and %d lenses loaded in %.0fs", len(lenses), loaded - start)
    best = write_swaps(
        model,
        lenses,
        layers,
        model_name=args.model,
        lens_files=args.lens,
        scales=scales,
        out_dir=out,
        strip_word_answers=args.strip_word_answers,
        load_seconds=loaded - start,
    )
    print(best.to_string(index=False))


def write_swaps(
    model,
    lenses: dict,
    layers: list[int],
    *,
    model_name: str,
    lens_files: list[str],
    scales: list[float],
    out_dir: Path,
    strip_word_answers: bool,
    load_seconds: float = 0,
) -> pd.DataFrame:
    """Runs the swap trials of `lenses` (`{name: lens}`, each a JacobianLens or the logit lens) and
    writes the four files. Returns the best-scale rows. The harness in evals/workspace-lenses
    calls this too."""
    slug = model_name.split("/")[-1]
    out_dir.mkdir(parents=True, exist_ok=True)
    loaded = time.time()
    swap_trials = load_probe_swap_trials(include_controls=True)
    if strip_word_answers:
        swap_trials = with_strip_rule(model.tokenizer, swap_trials)
    trials, dropped = run_trials(model, lenses, swap_trials, layers, scales)
    done = time.time()
    logger.info("%d trial rows in %.0fs", len(trials), done - loaded)

    success = success_by_variant(trials)
    best = best_scale_rows(probe_swap_success_table(trials))
    trials.to_parquet(out_dir / f"{slug}_probe_swap_trials.parquet", index=False)
    success.to_csv(out_dir / f"{slug}_probe_swap_success.csv", index=False)
    best.to_csv(out_dir / f"{slug}_probe_swap_best_scale.csv", index=False)
    commit = subprocess.run(
        ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=False
    ).stdout.strip()
    header = {
        "model": model_name,
        "layers": layers,
        "scales": scales,
        "lenses": dict(zip(lenses, lens_files, strict=True)),
        "variants": list(VARIANTS),
        "items": PROBE_SWAP_PATH,
        "max_seq_len": MAX_SEQ_LEN,
        "strip_word_answers": strip_word_answers,
        "dropped_concepts": [list(d) for d in dropped],
        "jpp_lens_commit": commit,
        "torch": t.__version__,
        "gpus": [t.cuda.get_device_name(i) for i in range(t.cuda.device_count())],
        "load_seconds": round(load_seconds),
        "run_seconds": round(done - loaded),
    }
    (out_dir / f"{slug}_probe_swap_header.json").write_text(json.dumps(header, indent=2) + "\n")
    return best

if __name__ == "__main__":
    main()
