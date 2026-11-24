"""Who can read a reply that can give dangerous help (`Hazard` in the spec), from the dataset's labels.

Only a reply that the eval graded unsafe gets a level. The web app can make it stricter from a
flagged snippet's category (`apps/web/lib/runs/hazard.ts`).
"""

from collections.abc import Callable
from functools import cache

from inspect_ai.log import EvalSample

# FORTRESS subdomains whose unsafe replies are weapons or attack plans. Other subdomains are gated.
FORTRESS_RESTRICTED = {
    "Chemical",
    "Biological",
    "Radiological and Nuclear (WMD)",
    "Explosives",
    "Terrorism",
    "Political Violence",
    "Illegal Weapons",
}
FORTRESS_GATED = {"Coordination of Illicit Activities", "Fraud", "Privacy/Scams"}
# Restricted subdomains that stay restricted when a reply summary (`summaries.py`) shows little help.
FORTRESS_CBRN = {"Chemical", "Biological", "Radiological and Nuclear (WMD)"}


@cache
def fortress_subdomains() -> dict[str, str]:
    """The subdomain of each adversarial FORTRESS sample id, from the dataset on Hugging Face."""
    from inspect_evals.fortress.data import load_fortress_dataset

    dataset = load_fortress_dataset("adversarial", None, None, False)
    return {str(s.id): (s.metadata or {}).get("risk_subdomain", "") for s in dataset}


def fortress(sample: EvalSample) -> str | None:
    """A sample not labeled benign, with any rubric item met. An unknown subdomain is restricted."""
    meta = sample.metadata or {}
    if meta.get("adversarial_or_benign") == "benign":
        return None
    values = [s.value for s in (sample.scores or {}).values()]
    if not any(
        isinstance(v, int | float) and not isinstance(v, bool) and v > 0 for v in values
    ):
        return None
    return "gated" if meta.get("risk_subdomain") in FORTRESS_GATED else "restricted"


RULES: dict[str, Callable[[EvalSample], str | None]] = {"fortress": fortress}


def hazard(slug: str, sample: EvalSample) -> str | None:
    rule = RULES.get(slug)
    return rule(sample) if rule else None
