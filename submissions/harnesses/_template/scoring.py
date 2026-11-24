"""The metrics of a run. TEMPLATE: use the metrics of your eval, with the names of its eval entry.

Keep the scoring here, apart from the model code, so that the tests need no GPU and no download.
"""

from __future__ import annotations


def metrics(rows: list[dict]) -> dict[str, float]:
    """Balanced accuracy: the mean of the true positive rate (label 1) and the true negative rate
    (label 0). A detector that flags all items, or none, gets 0.5."""
    pos = [r for r in rows if r["label"] == 1]
    neg = [r for r in rows if r["label"] == 0]
    if not pos or not neg:
        raise ValueError("the items need both labels")
    tpr = sum(r["flagged"] for r in pos) / len(pos)
    tnr = sum(not r["flagged"] for r in neg) / len(neg)
    return {"balanced_accuracy": (tpr + tnr) / 2, "tpr": tpr, "tnr": tnr}
