"""The scores of a WorkspaceBench run, from the results.json that `wsbench judge` writes for each
family.

Each family has one headline value (`numbers.value`): a pass rate, or a pair rate for paired
families. Some can be below 0 (a rate minus a control rate). The headline of the run,
`macro_score`, is the mean of the values of the families that WorkspaceBench puts in its macro,
over the families that are complete. A family that did not run, or that is not complete, makes
the macro partial: `macro_families` tells how many families it has. A fast version (on a fast
subset) uses WorkspaceBench's own macro, with all of its rules (`macro_metrics`).

This file needs only the Python standard library.
"""

from __future__ import annotations

import json
from pathlib import Path

MACRO_METRICS = ("pass_rate", "pair_rate")


def _round(x: float) -> float:
    # Math.round in an import script rounds halves up; Python's round() rounds them to even.
    return int(x * 1000 + 0.5) / 1000 if x >= 0 else -int(-x * 1000 + 0.5) / 1000


def family_row(path: str | Path) -> dict:
    """The facts of one family from its `wsbench judge` results.json."""
    d = json.loads(Path(path).read_text(encoding="utf-8"))
    n = d.get("numbers") or {}
    c = d.get("config") or {}
    return {
        "family": d["family"],
        "metric": n.get("metric"),
        "value": n.get("value"),
        "ci95": n.get("ci95"),
        "nItems": d.get("n_items"),
        "complete": bool(d.get("complete")),
        "reads": c.get("reads", "full"),
        "judgeModel": c.get("judge_model"),
        "promptVersion": c.get("prompt_version"),
        "spendUsd": (d.get("counts") or {}).get("spend_usd", 0.0),
    }


def macro(rows: list[dict], in_macro: set[str]) -> dict:
    """`{macro_score, macro_families}` over the complete rows of the macro families."""
    vals = [
        r["value"]
        for r in rows
        if r["family"] in in_macro
        and r["complete"]
        and r["metric"] in MACRO_METRICS
        and r["value"] is not None
    ]
    return {
        "macro_score": _round(sum(vals) / len(vals)) if vals else None,
        "macro_families": len(vals),
    }


def _with_families(m: dict, rows: list[dict]) -> dict[str, float]:
    out: dict[str, float] = {k: v for k, v in m.items() if v is not None}
    for r in rows:
        if r["value"] is not None:
            out[r["family"]] = _round(r["value"])
    return out


def metrics(rows: list[dict], in_macro: set[str]) -> dict[str, float]:
    """The eval's metrics: `macro_score`, `macro_families`, and the value of each family."""
    return _with_families(macro(rows, in_macro), rows)


def macro_metrics(rows: list[dict], wsb_macro: dict) -> dict[str, float]:
    """The eval's metrics from WorkspaceBench's own macro (`results.macro`: `value`, and the
    `families` in it)."""
    value = wsb_macro["value"]
    m = {
        "macro_score": _round(value) if value is not None else None,
        "macro_families": len(wsb_macro["families"]),
    }
    return _with_families(m, rows)
