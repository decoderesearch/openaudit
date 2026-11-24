"""The auditor rule: an auditor is never the target model, and a Claude target gets an auditor
from another family. The web app has the same rule (`apps/web/lib/runs/auditor.ts`)."""

from typing import Any

from .ladders import lab, model_id, role_models

# Auditors to use in place of a default that breaks the rule, in order (spec/model-ladders.yaml).
OTHER_AUDITORS: list[str] = role_models("auditor")


def auditor_problem(target: str, auditor: str) -> str | None:
    """Why `auditor` cannot audit `target`, or None."""
    if model_id(auditor) == model_id(target):
        return f"The auditor {auditor} is the target model."
    if lab(target) == "anthropic" and lab(auditor) == "anthropic":
        return f"The target {target} is a Claude model, so the auditor must not be {auditor}."
    return None


def check_auditors(
    slots: list[dict[str, Any]],
    routes: dict[str, dict[str, Any]],
    target: str,
    chosen: set[str],
) -> dict[str, dict[str, Any]]:
    """`routes` with each auditor slot that breaks the rule given an auditor from
    `OTHER_AUDITORS`. Fails when a chosen auditor (a slot in `chosen`) breaks the rule."""
    out = dict(routes)
    for slot in slots:
        sid = slot["id"]
        if slot["role"] != "auditor" or sid not in out:
            continue
        problem = auditor_problem(target, out[sid]["model"])
        if not problem:
            continue
        if sid in chosen:
            raise ValueError(problem)
        other = next((m for m in OTHER_AUDITORS if not auditor_problem(target, m)), None)
        if other is None:
            raise ValueError(f"{problem} No other auditor is set.")
        out[sid] = {"kind": "openrouter", "model": other, "allowFallbacks": True}
    return out
