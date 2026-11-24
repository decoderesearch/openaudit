# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "huggingface_hub==2.3.0",
# ]
# ///
"""Run the OpenAudit <Eval Name> eval on your detector. Start it with ./run.sh (see README.md).

TEMPLATE: change each part that has "TEMPLATE". This template scores a detector on labeled items:
each item has a text and a label (1 or 0). Your eval can need other inputs (activations, a model,
an API). Keep the rest: the pinned data, the sha256 of the artifact, the harness commit and the
form of results.json.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

import scoring

HERE = Path(__file__).resolve().parent
# TEMPLATE: openaudit.<harness folder>.results/1. Add 1 when the form of results.json changes.
RESULTS_SCHEMA = "openaudit.my-harness.results/1"
# TEMPLATE: the eval slug and version, as in the eval entry (seed/<slug>.json).
EVAL = ("my-eval", "2026-11")
# TEMPLATE: the data, on Hugging Face at a commit, and the sha256 of the file.
DATASET = "<owner>/<dataset>"
REVISION = "0000000000000000000000000000000000000000"
DATA_FILE = "items.jsonl"
DATA_SHA256 = "0000000000000000000000000000000000000000000000000000000000000000"
SMOKE_LIMIT = 50


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def git(*args: str) -> str:
    done = subprocess.run(
        ["git", *args], cwd=HERE, capture_output=True, text=True, check=False
    )
    # A git error (for example "dubious ownership") must not give a clean run.
    if done.returncode:
        raise SystemExit(f"git {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout.strip()


def harness_info() -> dict:
    """The repo commit of the run, and if this folder had changes that are not in it."""
    return {
        "openaudit": git("rev-parse", "HEAD"),
        "openauditDirty": bool(git("status", "--porcelain", "--", str(HERE))),
    }


def load_module(path: Path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_items() -> list[dict]:
    """TEMPLATE: the items of the eval. Each row has `text` and `label` (1 or 0)."""
    from huggingface_hub import hf_hub_download

    path = Path(
        hf_hub_download(DATASET, DATA_FILE, repo_type="dataset", revision=REVISION)
    )
    if sha256_of(path) != DATA_SHA256:
        raise SystemExit(f"{DATA_FILE}: the sha256 is not {DATA_SHA256}")
    # Not splitlines(): it also splits on Unicode line breaks inside text.
    return [json.loads(line) for line in path.read_text().split("\n") if line]


def write_results(out: Path, model: str, run: dict) -> Path:
    """Adds the run of `model` to out/results.json. A new run of a model replaces the old one."""
    path = out / "results.json"
    results = json.loads(path.read_text()) if path.exists() else {}
    results["schema"] = RESULTS_SCHEMA
    results.setdefault("runs", {})[model] = run
    path.write_text(json.dumps(results, indent=2) + "\n")
    return path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--detector", type=Path, required=True, help="your detector .py file"
    )
    parser.add_argument(
        "--model", required=True, help="the subject model, a Hugging Face ID"
    )
    parser.add_argument("--out", type=Path, required=True, help="output folder")
    parser.add_argument("--limit", type=int, help="only the first N items: a smoke run")
    args = parser.parse_args()
    start = time.time()
    args.out.mkdir(parents=True, exist_ok=True)

    items = load_items()[: args.limit]
    detector = load_module(args.detector).load_detector(args.model)
    rows = []
    for i, item in enumerate(items):
        score = detector.score(item["text"])
        rows.append(
            {
                "i": i,
                "label": item["label"],
                "score": score,
                "flagged": score > detector.threshold,
            }
        )
    with open(args.out / "scores.jsonl", "w") as f:
        f.writelines(json.dumps(r) + "\n" for r in rows)

    run = {
        "model": args.model,
        "tier": "smoke" if args.limit else "full",
        "partial": bool(args.limit),
        # TEMPLATE: the key is `artifact` in submission/rules.json.
        "detector": {"file": args.detector.name, "sha256": sha256_of(args.detector)},
        "harness": harness_info(),
        "data": {"dataset": DATASET, "revision": REVISION, "file": DATA_FILE},
        "evals": {EVAL[0]: {"version": EVAL[1], "metrics": scoring.metrics(rows)}},
        "seconds": round(time.time() - start),
        "date": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    path = write_results(args.out, args.model, run)
    print(json.dumps(run["evals"], indent=2))
    print(f"wrote {path}")
    if args.limit:
        print(f"--limit {args.limit}: a smoke run. Do not submit it.")


if __name__ == "__main__":
    main()
