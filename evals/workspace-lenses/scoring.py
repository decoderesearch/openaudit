"""The scores of the Workspace Lens evals, from the files that the harness writes.

The same rules as data/scripts/fetch-openaudit-lens-readout.mjs, which imports our own runs, so a
self-score and our score of the same files are equal.

Readout (Workspace Lens Readout 2026-10.3): a rank is of one hidden token of one item at one layer.
Items in the J++ Lens fit split do not count. Per item, the best rank of each hidden token over the
readout layers, then the share of hidden tokens with rank <= k, the mean over the item's tokens,
then over the task's items. The headline `recall_at_10` is the mean over the tasks that have items.

Probe swap (Workspace Probe Swap 2026-11): each lens's best top-1 scale of the main trials (ties
go to the smaller scale), with the two controls at that scale.

This file needs only the Python standard library.
"""

from __future__ import annotations

import csv
import gzip
import json
from collections import defaultdict
from pathlib import Path

TASKS = ("association", "multihop", "multilingual", "poetry", "typo")
KS = (1, 10)
SWAP_PREFIX = (
    ("main", "swap_top1"),
    ("answer_swap", "answer_swap_top1"),
    ("random_null", "random_swap_top1"),
)


def _round(x: float) -> float:
    # Math.round in the import script rounds halves up; Python's round() rounds them to even.
    return int(x * 1000 + 0.5) / 1000 if x >= 0 else -int(-x * 1000 + 0.5) / 1000


def read_samples(path: str | Path) -> tuple[dict, list[dict]]:
    """The header and the item lines of a sample file (.jsonl or .jsonl.gz)."""
    opener = gzip.open if str(path).endswith(".gz") else open
    with opener(path, "rt", encoding="utf-8") as f:
        lines = [json.loads(line) for line in f if line.strip()]
    return lines[0]["header"], lines[1:]


def readout_recall(
    header: dict, items: list[dict], layers: list[int] | None = None
) -> dict:
    """`{lens: {task: {k: recall}}}` over `layers` (default: all layers in the file)."""
    keep = set(layers or header["layers"])
    file_layers = header["layers"]
    best: dict[tuple[str, str, str, str], int] = {}
    for s in items:
        if s.get("split") == "fit":
            continue
        for lens, d in (s.get("lenses") or {}).items():
            for intermediate, ranks in d["ranks"].items():
                for i, rank in enumerate(ranks):
                    if file_layers[i] not in keep:
                        continue
                    key = (lens, s["eval"], s["item"], intermediate)
                    best[key] = min(best.get(key, rank), rank)
    by_item: dict[tuple[str, str, str], list[int]] = defaultdict(list)
    for (lens, task, item, _), rank in best.items():
        by_item[(lens, task, item)].append(rank)
    hits: dict[str, dict[str, dict[int, list[float]]]] = {}
    for (lens, task, _), ranks in by_item.items():
        for k in KS:
            hit = sum(r <= k for r in ranks) / len(ranks)
            hits.setdefault(lens, {}).setdefault(task, {}).setdefault(k, []).append(hit)
    return {
        lens: {
            task: {k: sum(v) / len(v) for k, v in by_k.items()}
            for task, by_k in tasks.items()
        }
        for lens, tasks in hits.items()
    }


def readout_metrics(by_task: dict) -> dict[str, float]:
    """The eval's metrics from `{task: {k: recall}}`: the macro recall@1 and recall@10, and the
    recall@10 of each task."""
    tasks = [t for t in TASKS if t in by_task]
    metrics = {
        f"recall_at_{k}": _round(sum(by_task[t][k] for t in tasks) / len(tasks))
        for k in KS
    }
    for t in tasks:
        metrics[f"{t}_recall_at_10"] = _round(by_task[t][10])
    return metrics


def swap_metrics(path: str | Path) -> dict[str, dict[str, float]]:
    """`{lens: metrics}` from a `_probe_swap_success.csv`."""
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    out: dict[str, dict[str, float]] = {}
    for lens in dict.fromkeys(r["lens"] for r in rows):
        mine = [r for r in rows if r["lens"] == lens]
        main = sorted(
            (r for r in mine if r["variant"] == "main"),
            key=lambda r: (-float(r["top1_rate"]), float(r["scale"])),
        )
        best = main[0]
        at_best = {
            r["variant"]: float(r["top1_rate"])
            for r in mine
            if float(r["scale"]) == float(best["scale"])
        }
        m = {
            "swap_top1": _round(float(best["top1_rate"])),
            "swap_top5": _round(float(best["top5_rate"])),
            "answer_swap_top1": _round(at_best["answer_swap"]),
            "random_swap_top1": _round(at_best["random_null"]),
        }
        for variant, prefix in SWAP_PREFIX:
            for r in mine:
                if r["variant"] == variant:
                    scale = f"{float(r['scale']):g}".replace(".", "_")
                    m[f"{prefix}_scale_{scale}"] = _round(float(r["top1_rate"]))
        out[lens] = m
    return out
