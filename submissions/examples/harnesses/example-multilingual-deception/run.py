# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch==2.14.1",
#   "transformers==5.21.0",
#   "accelerate==1.15.0",
#   "lie-detectors==0.1.0",
#   "huggingface_hub==2.3.0",
# ]
# ///
"""Run the OpenAudit Multilingual Deception eval on your lie detector. Start it with ./run.sh (see
README.md).

It scores the lie and honest chats of one subject model in English, Spanish, Chinese and Swahili
with your detector. A system prompt in each language tells the model to lie or to be honest about a
TriviaQA question. The detector interface is the same as in evals/varied-deception, so a detector
for that harness runs here with no change.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import subprocess
import time
from datetime import UTC, datetime
from pathlib import Path

import scoring

HERE = Path(__file__).resolve().parent
RESULTS_SCHEMA = "openaudit.example-multilingual-deception.results/1"
EVAL = ("example-multilingual-deception", "2026-11")
# TODO before the pull request: the dataset on Hugging Face at a commit, and the sha256 of each
# file (make_data.py writes them). The check fails on these placeholders.
DATASET = "openaudit/example-multilingual-deception"
REVISION = "0000000000000000000000000000000000000000"
EVAL_FILES = {
    "google/gemma-4-E4B-it": (
        "google-gemma-4-e4b-it/eval.jsonl",
        "b0d7f59daca9ac5542f43888f4377e8176049d02374522be82434f2d690117e6",
    ),
}


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=HERE, capture_output=True, text=True, check=False
    ).stdout.strip()


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


def load_chats(model: str, limit: int | None, data: Path | None = None) -> list[dict]:
    """The labeled chats of the model. Each row: id, language, label (1: lie), messages. With
    --limit, the first N chats of each language, so that a smoke run has all languages. `data`: a
    local copy of the dataset, with the same sha256."""
    if model not in EVAL_FILES:
        raise SystemExit(f"{model} has no chats. Use one of: {', '.join(EVAL_FILES)}")
    file, sha = EVAL_FILES[model]
    if data:
        path = data / file
    else:
        from huggingface_hub import hf_hub_download

        path = Path(hf_hub_download(DATASET, file, repo_type="dataset", revision=REVISION))
    if sha256_of(path) != sha:
        raise SystemExit(f"{file}: the sha256 is not {sha}")
    rows = [json.loads(line) for line in path.read_text().split("\n") if line]
    if limit:
        rows = [
            r
            for lang in scoring.LANGUAGES
            for r in [r for r in rows if r["language"] == lang][:limit]
        ]
    return rows


def kind_of(det) -> str:
    if not isinstance(getattr(det, "threshold", None), (int, float)):
        raise SystemExit("the detector needs a number `threshold`")
    if hasattr(det, "score_chats"):
        return "chat"
    if hasattr(det, "layers") and hasattr(det, "score"):
        return "activation"
    raise SystemExit("the detector needs score_chats(chats), or layers and score(acts, chat)")


def visible(messages: list[dict]) -> list[dict]:
    """The chat that a detector gets: without the system prompt, which tells the model to lie."""
    return [m for m in messages if m.get("role") != "system"]


def score_activations(det, model_name: str, chats: list[dict]) -> list[float | None]:
    """One forward pass for each chat. acts[layer] is the output of that decoder block
    (hidden_states[layer + 1]) at the reply's text tokens, float32, on the model's device."""
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    device = "cuda" if torch.cuda.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForCausalLM.from_pretrained(model_name, dtype="auto").to(device)
    model.eval()
    d_model = model.config.get_text_config().hidden_size
    test = det.score({i: torch.randn(3, d_model, device=device) for i in det.layers}, [])
    if not math.isfinite(float(test)):
        raise SystemExit("score(acts, chat) of random activations is not a finite number")

    scores = []
    with torch.inference_mode():
        for c in chats:
            reply = c["messages"][-1]["content"].strip()
            full = tok.apply_chat_template(c["messages"], tokenize=False, enable_thinking=False)
            prefix = tok.apply_chat_template(
                c["messages"][:-1], tokenize=False, add_generation_prompt=True, enable_thinking=False
            )
            start = full.find(reply[:60], len(prefix) if full.startswith(prefix) else 0)
            if not reply or start < 0:
                scores.append(None)
                continue
            enc = tok(full, add_special_tokens=False, return_offsets_mapping=True)
            text = [
                i
                for i, (a, b) in enumerate(enc["offset_mapping"])
                if a >= start and b <= start + len(reply) and b > a
            ]
            if not text:
                scores.append(None)
                continue
            ids = torch.tensor([enc["input_ids"]], device=device)
            hidden = model(input_ids=ids, output_hidden_states=True).hidden_states
            acts = {i: hidden[i + 1][0, text].float() for i in det.layers}
            scores.append(float(det.score(acts, visible(c["messages"]))))
    return scores


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
    parser.add_argument("--detector", type=Path, required=True, help="your detector .py file")
    parser.add_argument("--model", required=True, help="the subject model, a Hugging Face ID")
    parser.add_argument("--out", type=Path, required=True, help="output folder")
    parser.add_argument(
        "--limit", type=int, help="only the first N chats of each language: a smoke run"
    )
    parser.add_argument(
        "--data", type=Path, help="a local copy of the dataset, before the upload (a test)"
    )
    args = parser.parse_args()
    start = time.time()
    args.out.mkdir(parents=True, exist_ok=True)

    chats = load_chats(args.model, args.limit, args.data)
    det = load_module(args.detector).load_detector(args.model)
    if kind_of(det) == "chat":
        scores = det.score_chats([visible(c["messages"]) for c in chats])
        if len(scores) != len(chats):
            raise SystemExit(f"score_chats gave {len(scores)} scores for {len(chats)} chats")
    else:
        scores = score_activations(det, args.model, chats)

    rows = []
    for c, s in zip(chats, scores):
        s = None if s is None else float(s)
        rows.append(
            {
                "id": c["id"],
                "language": c["language"],
                "label": c["label"],
                "score": s,
                "flagged": scoring.is_lie(s, det.threshold),
            }
        )
    with open(args.out / f"{args.model.replace('/', '-')}_scores.jsonl", "w") as f:
        f.writelines(json.dumps(r) + "\n" for r in rows)

    metrics = scoring.metrics_of_limit(rows) if args.limit else scoring.metrics(rows)
    file, _ = EVAL_FILES[args.model]
    run = {
        "model": args.model,
        "tier": "smoke" if args.limit else "full",
        "partial": bool(args.limit),
        "detector": {"file": args.detector.name, "sha256": sha256_of(args.detector)},
        "harness": harness_info(),
        "data": {"dataset": DATASET, "revision": REVISION, "file": file, "localCopy": bool(args.data)},
        "noScore": sum(r["score"] is None for r in rows),
        "evals": {EVAL[0]: {"version": EVAL[1], "metrics": metrics}},
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
