import csv
import gzip
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parent.parent
sys.path.insert(0, str(HERE))

import scoring


def write_samples(path: Path, items: list[dict], layers=(4, 8)) -> None:
    with gzip.open(path, "wt") as f:
        f.write(json.dumps({"header": {"layers": list(layers)}}) + "\n")
        for item in items:
            f.write(json.dumps(item) + "\n")


def item(task, name, ranks, split="held-out"):
    return {
        "eval": task,
        "item": name,
        "split": split,
        "lenses": {"a": {"ranks": ranks}},
    }


def test_readout_takes_the_best_layer_and_skips_the_fit_split(tmp_path):
    path = tmp_path / "s.jsonl.gz"
    write_samples(
        path,
        [
            # Two hidden tokens: best ranks 1 and 12, so recall@1 = recall@10 = 0.5.
            item("multihop", "x", {"p": [5, 1], "q": [12, 30]}),
            # Rank 3: recall@1 = 0, recall@10 = 1.
            item("typo", "y", {"p": [3, 9]}),
            item("typo", "fit", {"p": [1, 1]}, split="fit"),
        ],
    )
    header, items = scoring.read_samples(path)
    by_task = scoring.readout_recall(header, items)["a"]
    assert by_task == {"multihop": {1: 0.5, 10: 0.5}, "typo": {1: 0.0, 10: 1.0}}
    assert scoring.readout_metrics(by_task) == {
        "recall_at_1": 0.25,
        "recall_at_10": 0.75,
        "multihop_recall_at_10": 0.5,
        "typo_recall_at_10": 1.0,
    }


def test_readout_uses_only_the_given_layers(tmp_path):
    path = tmp_path / "s.jsonl.gz"
    write_samples(path, [item("poetry", "x", {"p": [1, 50]})])
    header, items = scoring.read_samples(path)
    assert scoring.readout_recall(header, items, [8])["a"]["poetry"] == {
        1: 0.0,
        10: 0.0,
    }


def test_round_halves_go_up():
    assert scoring._round(0.0125) == 0.013
    assert scoring._round(0.1235) == 0.124


def test_swap_takes_the_best_scale_and_the_smaller_on_ties(tmp_path):
    path = tmp_path / "success.csv"
    rows = [
        ("a", "main", 0.5, 0.2, 0.4),
        ("a", "main", 1.0, 0.6, 0.8),
        ("a", "main", 2.0, 0.6, 0.9),
        ("a", "answer_swap", 0.5, 0.1, 0.2),
        ("a", "answer_swap", 1.0, 0.3, 0.5),
        ("a", "answer_swap", 2.0, 0.4, 0.5),
        ("a", "random_null", 0.5, 0.0, 0.1),
        ("a", "random_null", 1.0, 0.05, 0.1),
        ("a", "random_null", 2.0, 0.1, 0.1),
    ]
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["lens", "variant", "scale", "top1_rate", "top5_rate"])
        w.writerows(rows)
    m = scoring.swap_metrics(path)["a"]
    assert m["swap_top1"] == 0.6 and m["swap_top5"] == 0.8
    assert m["answer_swap_top1"] == 0.3 and m["random_swap_top1"] == 0.05
    assert m["swap_top1_scale_0_5"] == 0.2 and m["swap_top1_scale_2"] == 0.6
    assert m["random_swap_top1_scale_1"] == 0.05


OFFICIAL = {
    "Qwen/Qwen3.6-27B": ("qwen3.6-27b", [8, 16, 24, 32, 40, 48, 56]),
    "Qwen/Qwen3.5-9B": ("qwen3.5-9b", [4, 8, 12, 16, 20, 24, 28]),
}


@pytest.mark.parametrize("model", OFFICIAL)
def test_scores_of_our_runs_equal_the_imported_ones(model):
    """Needs the sample cache of data/scripts/fetch-openaudit-lens-readout.mjs."""
    np_id, layers = OFFICIAL[model]
    slug = model.split("/")[1]
    cache = REPO / "data" / "cache"
    samples = (
        cache
        / "workspace-lens-readout"
        / "samples-strip"
        / f"{slug}_readout_samples.jsonl.gz"
    )
    swaps = (
        cache / "workspace-lens-probe-swap" / np_id / f"{slug}_probe_swap_success.csv"
    )
    if not samples.exists() or not swaps.exists():
        pytest.skip("no sample cache")
    header, items = scoring.read_samples(samples)
    readout = [
        scoring.readout_metrics(t)
        for t in scoring.readout_recall(header, items, layers).values()
    ]
    swap = list(scoring.swap_metrics(swaps).values())
    extracted = json.loads(
        (
            REPO / "data" / "extracted" / "methods" / "openaudit-lens-readout.json"
        ).read_text()
    )
    for artifact in extracted["artifacts"]:
        if artifact["subject"] != model:
            continue
        for r in artifact["results"]:
            if r["eval"] == "workspace-lens-readout" and r["version"] == "2026-10.3":
                assert r["metrics"] in readout, artifact["key"]
            if r["eval"] == "workspace-probe-swap":
                assert r["metrics"] in swap, artifact["key"]
