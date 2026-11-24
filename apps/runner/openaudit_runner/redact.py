"""The public copy of a run's log: the log without the attempts that a reader with no staff role
cannot read. The site has the same rules (`lib/server/hazard.ts`, `lib/runs/hazard.ts`) and
serves the copy only when it leaves out each attempt that the site hides now. Both test the
rules with `spec/fixtures/hazard-levels.json`.

The cards container makes the copies: after a card build flags and summarizes its runs, and for
all runs at the end of `cards drain`. A copy that leaves out nothing is the log itself."""

from __future__ import annotations

import hashlib
import json
import tempfile
import zipfile
from pathlib import Path
from typing import Any

from inspect_ai._util.zipfile import zipfile_compress_kwargs
from inspect_ai.log._recorders.eval import (
    HEADER_JSON,
    JOURNAL_DIR,
    REDUCTIONS_JSON,
    SAMPLES_DIR,
    START_JSON,
    SUMMARIES_JSON,
    SUMMARY_DIR,
)

from .store import Db

FINISHED = ("succeeded", "failed", "cancelled")
RANK = {"gated": 1, "restricted": 2, "withheld": 3}
# Not for a reader with no staff role (`canReadHazard`).
LOCKED = {"restricted", "withheld"}
# A reply summary that has no level.
NO_SUMMARY = object()


def snippet_hazard(category: str, severity: str) -> str | None:
    """`snippetHazard`: the level of a flagged snippet's category and severity."""
    high = severity in ("high", "critical")
    if category == "child_safety":
        return "withheld"
    if category == "bio_chem" or (category == "harmful_requests" and high):
        return "restricted"
    if category == "cyber":
        return "restricted" if severity == "critical" else "gated"
    if category == "agentic_misuse" and high:
        return "gated"
    return None


def strictest(levels: list[str | None]) -> str | None:
    out = None
    for level in levels:
        if level and (not out or RANK[level] > RANK[out]):
            out = level
    return out


def attempt_hazard(
    own: str | None, judged: Any, snippets: list[dict[str, str]]
) -> str | None:
    """`attemptHazard`. `judged`: the reply summary's level, or NO_SUMMARY."""
    level = own if judged is NO_SUMMARY else judged
    for s in snippets:
        flag = snippet_hazard(s["category"], s["severity"])
        if judged is NO_SUMMARY or flag == "withheld":
            level = strictest([level, flag])
    return level


def locked(level: str | None, display: str | None, version_display: str | None) -> bool:
    """`lockedForPublic`."""
    return (display or version_display or "open") == "scores_only" or level in LOCKED


def omitted(db: Db, run_ids: list[str]) -> dict[str, list[dict[str, Any]]]:
    """The attempts that each run's public copy leaves out, by id. An attempt with no level, no
    snippet, no summary and no scores-only rule is open, so the query leaves it out."""
    attempts = db.execute(
        """SELECT a.id, a."runId", a."sampleId", a.epoch, a.hazard, a.display,
             v."sampleTerms"->>'display' AS version_display
           FROM eval_attempt a JOIN eval_run r ON r.id = a."runId" JOIN eval_version v ON v.id = r."evalVersionId"
           WHERE a."runId" = ANY(%s::uuid[]) AND (
             a.hazard IS NOT NULL OR COALESCE(a.display, v."sampleTerms"->>'display') = 'scores_only'
             OR EXISTS (SELECT 1 FROM openaudit_snippet s WHERE s."attemptId" = a.id)
             OR EXISTS (SELECT 1 FROM reply_summary s WHERE s."attemptId" = a.id AND s.uplift IS NOT NULL))""",
        (run_ids,),
    ).fetchall()
    snippets: dict[str, list[dict[str, str]]] = {}
    for s in db.execute(
        'SELECT "attemptId", category, severity FROM openaudit_snippet WHERE "runId" = ANY(%s::uuid[])',
        (run_ids,),
    ).fetchall():
        snippets.setdefault(str(s["attemptId"]), []).append(s)
    judged = {
        str(s["attemptId"]): s["hazard"]
        for s in db.execute(
            """SELECT s."attemptId", s.hazard FROM reply_summary s JOIN eval_attempt a ON a.id = s."attemptId"
               WHERE a."runId" = ANY(%s::uuid[]) AND s.uplift IS NOT NULL""",
            (run_ids,),
        ).fetchall()
    }
    out: dict[str, list[dict[str, Any]]] = {r: [] for r in run_ids}
    for a in sorted(attempts, key=lambda a: str(a["id"])):
        i = str(a["id"])
        level = attempt_hazard(a["hazard"], judged.get(i, NO_SUMMARY), snippets.get(i, []))
        if locked(level, a["display"], a["version_display"]):
            out[str(a["runId"])].append(a)
    return out


def redacted_key(run_id: str, omit_ids: list[str]) -> str:
    digest = hashlib.sha256(",".join(sorted(omit_ids)).encode()).hexdigest()[:16]
    return f"runs/{run_id}/redacted/{digest}.eval"


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def sample_of(name: str) -> tuple[str, int]:
    sid, _, epoch = name.removeprefix(f"{SAMPLES_DIR}/").removesuffix(".json").rpartition("_epoch_")
    return sid, int(epoch)


def redact_log(src: Path, out: Path, omit: set[tuple[str, int]]) -> None:
    """Writes `src` without the samples in `omit` (sample id, epoch): their sample files, their
    summaries, and their reductions. Members of other kinds can hold sample text, so they do not
    go in the copy."""
    ids = {sid for sid, _ in omit}
    summaries = f"{JOURNAL_DIR}/{SUMMARY_DIR}/"
    with zipfile.ZipFile(src) as z, zipfile.ZipFile(out, "w", **zipfile_compress_kwargs) as dst:
        members = {sample_of(n) for n in z.namelist() if n.startswith(f"{SAMPLES_DIR}/")}
        if missing := omit - members:
            raise RuntimeError(f"No sample file for {len(missing)} attempts to leave out, such as {min(missing)}.")
        for info in z.infolist():
            name = info.filename
            if name.startswith(f"{SAMPLES_DIR}/"):
                if sample_of(name) in omit:
                    continue
                copy = zipfile.ZipInfo(name, date_time=info.date_time)
                copy.compress_type = info.compress_type
                dst.writestr(copy, z.read(info))
            elif name == SUMMARIES_JSON or name.startswith(summaries):
                kept = [s for s in json.loads(z.read(info)) if (str(s["id"]), s["epoch"]) not in omit]
                dst.writestr(name, json_bytes(kept))
            elif name == REDUCTIONS_JSON:
                reductions = json.loads(z.read(info))
                for r in reductions:
                    r["samples"] = [s for s in r["samples"] if str(s.get("sample_id")) not in ids]
                dst.writestr(name, json_bytes(reductions))
            elif name == HEADER_JSON:
                header = json.loads(z.read(info))
                spec = header.setdefault("eval", {})
                spec["metadata"] = {
                    **(spec.get("metadata") or {}),
                    "openaudit_redacted": {
                        "omitted_samples": len(omit),
                        "note": "OpenAudit left out the samples with replies that it does not show to the public.",
                    },
                }
                dst.writestr(name, json_bytes(header))
            elif name == f"{JOURNAL_DIR}/{START_JSON}":
                dst.writestr(name, z.read(info))


def finished_runs(db: Db, run_ids: list[str] | None = None) -> list[dict[str, Any]]:
    """The finished runs with a log (default: all of them)."""
    return db.execute(
        """SELECT id, "logKey", "logBytes", "redactedKey", "redactedOmit" FROM eval_run
           WHERE "logKey" IS NOT NULL AND status = ANY(%s) AND (%s::uuid[] IS NULL OR id = ANY(%s::uuid[]))
           ORDER BY id""",
        (list(FINISHED), run_ids, run_ids),
    ).fetchall()


def is_current(run: dict[str, Any], omit_ids: list[str]) -> bool:
    return bool(run["redactedKey"]) and sorted(str(i) for i in run["redactedOmit"] or []) == omit_ids


def stale_runs(db: Db, run_ids: list[str] | None = None) -> list[tuple[str, int]]:
    """The runs whose public copy is missing or out of date, with the count to leave out."""
    runs = finished_runs(db, run_ids)
    omit = omitted(db, [str(r["id"]) for r in runs])
    out = []
    for run in runs:
        omit_ids = [str(a["id"]) for a in omit[str(run["id"])]]
        if not is_current(run, omit_ids):
            out.append((str(run["id"]), len(omit_ids)))
    return out


def redact_run(db: Db, bucket: Any, run: dict[str, Any], omit: list[dict[str, Any]]) -> str:
    """Makes the run's public copy when the attempts to leave out (`omitted`) changed. Returns
    what it did."""
    run_id = str(run["id"])
    omit_ids = [str(a["id"]) for a in omit]
    if is_current(run, omit_ids):
        return "same"
    if not omit:
        key, size = run["logKey"], run["logBytes"]
    else:
        key = redacted_key(run_id, omit_ids)
        with tempfile.TemporaryDirectory() as tmp:
            src, out = Path(tmp) / "log.eval", Path(tmp) / "redacted.eval"
            src.write_bytes(bucket.get(run["logKey"]))
            redact_log(src, out, {(a["sampleId"], a["epoch"]) for a in omit})
            src.unlink()
            bucket.put_file(key, out, "application/zip")
            size = out.stat().st_size
    db.execute(
        """UPDATE eval_run SET "redactedKey" = %s, "redactedBytes" = %s, "redactedOmit" = %s::uuid[],
             "updatedAt" = now() WHERE id = %s""",
        (key, size, omit_ids, run_id),
    )
    return f"{len(omit)} left out"


def redact_runs(db: Db, bucket: Any, run_ids: list[str] | None = None) -> dict[str, int]:
    """`redact_run` for the runs (default: all finished runs with a log). A failure on one run
    does not stop the others."""
    counts: dict[str, int] = {"made": 0, "same": 0, "failed": 0}
    runs = finished_runs(db, run_ids)
    omit = omitted(db, [str(r["id"]) for r in runs])
    for run in runs:
        try:
            done = redact_run(db, bucket, run, omit[str(run["id"])])
        except Exception as e:  # noqa: BLE001 - the site serves no copy until one is made.
            counts["failed"] += 1
            print(f"Redact {run['id']}: {type(e).__name__}: {e}", flush=True)
            continue
        if done == "same":
            counts["same"] += 1
        else:
            counts["made"] += 1
            print(f"Redact {run['id']}: {done}.", flush=True)
    return counts
