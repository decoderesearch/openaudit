"""The parts of synth.py and saebench.py that are the same: load the SAE file, check the SAE, write
results.json and print the leaderboard. Imports torch only in check_sae and gpus."""

from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import subprocess
from datetime import UTC, datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
EXTRACTED = REPO / "data" / "extracted" / "methods"
RESULTS_SCHEMA = "openaudit.sparse-autoencoders.results/1"


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not hasattr(module, "load_sae"):
        raise SystemExit(f"{path} has no load_sae function")
    return module


def harness_info(here: Path) -> dict:
    def git(*args: str) -> str:
        return subprocess.run(
            ["git", *args], cwd=REPO, capture_output=True, text=True, check=False
        ).stdout.strip()

    return {
        "openaudit": git("rev-parse", "HEAD"),
        "openauditDirty": bool(git("status", "--porcelain", "--", str(here))),
    }


def gpus() -> list[str]:
    import torch

    return [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())]


def check_sae(sae, d_model: int, device) -> None:
    """Fails early if the SAE does not have encode, decode and W_dec [d_sae, d_model], or if it
    does not give finite values of the correct shape."""
    import torch

    w = getattr(sae, "W_dec", None)
    if w is None or w.ndim != 2 or w.shape[1] != d_model:
        raise SystemExit(f"the SAE needs W_dec [d_sae, {d_model}]")
    with torch.no_grad():
        x = torch.randn(4, d_model, device=device, dtype=w.dtype)
        z = sae.encode(x)
        y = sae.decode(z)
    if z.shape != (4, w.shape[0]) or y.shape != x.shape:
        raise SystemExit(
            f"encode gives {tuple(z.shape)}, decode gives {tuple(y.shape)}: expected (4, d_sae), (4, d_model)"
        )
    if not (torch.isfinite(z).all() and torch.isfinite(y).all()):
        raise SystemExit("encode or decode of random input is not finite")


def write_run(out: Path, subject: str, run: dict) -> Path:
    """Adds the run of `subject` to out/results.json. If the old run of the subject has the same SAE
    and tier, the evals of both runs are kept. If not, the new run replaces it."""
    out.mkdir(parents=True, exist_ok=True)
    path = out / "results.json"
    results = json.loads(path.read_text()) if path.exists() else {}
    results["schema"] = RESULTS_SCHEMA
    run = {
        "model": subject,
        **run,
        "date": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    old = results.get("runs", {}).get(subject)
    if (
        old
        and old.get("sae", {}).get("sha256") == run["sae"]["sha256"]
        and old.get("tier") == run["tier"]
    ):
        run["evals"] = old.get("evals", {}) | run["evals"]
        run["seconds"] += old.get("seconds", 0)
    results.setdefault("runs", {})[subject] = run
    path.write_text(json.dumps(results, indent=2) + "\n")
    print(f"\nwrote {path}")
    return path


def baseline_variants() -> dict[str, str]:
    """The baseline variants of the SAE method (as PCA and ICA Lens): slug to display name."""
    seed = json.loads(
        (REPO / "data" / "seed" / "methods" / "sparse-autoencoders.json").read_text()
    )
    return {v["slug"]: v["displayName"] for v in seed["variants"] if v.get("baseline")}


def published(
    subject: str, eval_slug: str, metric: str, baselines: bool = False
) -> list[tuple[float, str]]:
    """The published SAEs of this subject and eval: (value, name). `baselines`: the artifacts of
    the baseline variants, with the variant's name, not the SAEs."""
    names = baseline_variants()
    rows = []
    for path in sorted(EXTRACTED.glob("*.json")):
        for a in json.loads(path.read_text()).get("artifacts", []):
            if a.get("method") != "sparse-autoencoders" or a.get("subject") != subject:
                continue
            if (a.get("variant") in names) != baselines:
                continue
            for r in a.get("results", []):
                v = r.get("metrics", {}).get(metric)
                if (
                    r.get("eval") == eval_slug
                    and isinstance(v, (int, float))
                    and math.isfinite(v)
                ):
                    name = (
                        names[a["variant"]]
                        if baselines
                        else a.get("displayName") or a["key"]
                    )
                    rows.append((float(v), name))
    return rows


def leaderboard(
    subject: str,
    eval_slug: str,
    metric: str,
    value: float,
    top: int = 10,
    lower: bool = False,
) -> None:
    """Prints the rank of `value` among the published SAEs, then the mean of each baseline variant
    (not ranked). `lower`: a lower value is better."""
    rows = published(subject, eval_slug, metric)
    base: dict[str, list[float]] = {}
    for v, name in published(subject, eval_slug, metric, baselines=True):
        base.setdefault(name, []).append(v)
    if base:
        print(f"\n{eval_slug}, {metric}: the baselines (not ranked):")
        for name, vs in sorted(base.items()):
            print(f"  {sum(vs) / len(vs):.4f}  {name} (mean of {len(vs)})")
    if not rows:
        return
    sign = 1 if lower else -1
    rows.sort(key=lambda r: sign * r[0])
    rank = 1 + sum(sign * v < sign * value for v, _ in rows)
    print(
        f"\n{eval_slug}, {metric}: your SAE is number {rank} of {len(rows) + 1}. The top {top}:"
    )
    for v, name in rows[:top]:
        print(f"  {v:.4f}  {name}")
