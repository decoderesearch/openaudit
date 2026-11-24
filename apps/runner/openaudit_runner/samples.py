"""The `eval_sample` row of an Inspect sample: its split, source id and hash. The row keeps no text;
the attempts keep it."""

import hashlib
import json
import re
from collections.abc import Callable, Iterable
from typing import Any

import psycopg
from inspect_ai.log import EvalLog, EvalSample
from uuid6 import uuid7

from . import inspect_map as im

# Tasks whose split name is in no task arg or metadata value: the split from the task args.
SPLIT_RULES: dict[str, Callable[[dict[str, Any]], str]] = {
    "inspect_evals/agentharm": lambda a: f"harmful_{a.get('split') or 'test_public'}",
    "inspect_evals/agentharm_benign": lambda a: f"harmless_benign_{a.get('split') or 'test_public'}",
    "inspect_evals/truthfulqa": lambda a: "multiple_choice/validation",
    "openaudit_runner/jailbreakbench": lambda a: "harmful",
    "openaudit_runner/toxigen": lambda a: "annotated/test" if a.get("part") == "discriminative" else "prompts",
}

Key = tuple[str, str, str]
"""(split, source id, sha256)."""


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def split_of(
    sample_id: str,
    metadata: dict[str, Any],
    task: str,
    task_args: dict[str, Any],
    splits: list[dict[str, Any]],
    count: int | None,
) -> str | None:
    """The version split of a sample, or None if it is not clear. In order: a rule in `SPLIT_RULES`;
    the only split; the one split that a metadata value, a task arg, the task name or the id prefix
    names; the one split with the run's sample count."""
    names = [s["name"] for s in splits]
    if task in SPLIT_RULES:
        name = SPLIT_RULES[task](task_args)
        return name if name in names else None
    if len(names) == 1:
        return names[0]
    by_norm = {norm(n): n for n in names}
    values = [*metadata.values(), *task_args.values(), task.rpartition("/")[2]]
    found = {by_norm[k] for v in values if isinstance(v, str) and (k := norm(v)) in by_norm}
    sid = norm(sample_id)
    prefix = max((k for k in by_norm if sid.startswith(f"{k}_")), key=len, default=None)
    if prefix:
        found.add(by_norm[prefix])
    if found:
        return found.pop() if len(found) == 1 else None
    sized = [s["name"] for s in splits if count and s.get("sampleCount") == count]
    return sized[0] if len(sized) == 1 else None


def sample_hash(sample_id: str, input: str | list[Any]) -> str:
    """The sha256 of `{"id", "input"}` as JSON with sorted keys and no spaces. Chat input is
    `[{"role", "content"}]` with the text only."""
    text = (
        input
        if isinstance(input, str)
        else [{"role": m.role, "content": im.text_of(m.content)} for m in input]
    )
    body = json.dumps({"id": sample_id, "input": text}, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(body.encode()).hexdigest()


def sample_key(sample: EvalSample, log: EvalLog, splits: list[dict[str, Any]]) -> Key | None:
    sid = str(sample.id)
    split = split_of(
        sid,
        sample.metadata or {},
        log.eval.task,
        log.eval.task_args or {},
        splits,
        log.eval.dataset.samples,
    )
    return (split, sid, sample_hash(sid, sample.input)) if split else None


def save_samples(conn: psycopg.Connection, version_id: str, keys: Iterable[Key]) -> dict[tuple[str, str], str]:
    """Adds the samples that the version does not have. Returns the ids by (split, source id)."""
    rows = {(split, sid): sha for split, sid, sha in keys}
    if not rows:
        return {}
    with conn.cursor() as cur:
        cur.executemany(
            """INSERT INTO eval_sample (id, "evalVersionId", split, "sourceId", sha256)
               VALUES (%s, %s, %s, %s, %s)
               ON CONFLICT ("evalVersionId", split, "sourceId") DO NOTHING""",
            [(str(uuid7()), version_id, split, sid, sha) for (split, sid), sha in rows.items()],
        )
    found = conn.execute(
        """SELECT id, split, "sourceId" FROM eval_sample
           WHERE "evalVersionId" = %s AND "sourceId" = ANY(%s)""",
        (version_id, sorted({sid for _, sid in rows})),
    ).fetchall()
    return {(r["split"], r["sourceId"]): str(r["id"]) for r in found}


def refresh_stats(conn: psycopg.Connection, version_id: str) -> int | None:
    """Sets the graded and failed replies of the version's samples again (`refresh_sample_stats`).
    Returns the number of samples that changed, or None when the database has no such function
    (its migration is not there yet)."""
    if not conn.execute("SELECT to_regprocedure('refresh_sample_stats(uuid)') IS NOT NULL AS ok").fetchone()["ok"]:
        return None
    return conn.execute("SELECT refresh_sample_stats(%s) AS n", (version_id,)).fetchone()["n"]


def refresh_all_stats(
    conn: psycopg.Connection, slug: str | None = None, *, dry_run: bool = False
) -> list[tuple[str, str, int]]:
    """`refresh_stats` on each version with samples, or only the versions of the eval `slug`.
    Returns (eval slug, version, changed samples) for each. `dry_run`: count the changes; each
    version's change rolls back."""
    versions = conn.execute(
        """SELECT v.id, v.version, e.slug FROM eval_version v JOIN eval e ON e.id = v."evalId"
           WHERE EXISTS (SELECT 1 FROM eval_sample s WHERE s."evalVersionId" = v.id)
             AND (%(slug)s::text IS NULL OR e.slug = %(slug)s)
           ORDER BY e.slug, v.version""",
        {"slug": slug},
    ).fetchall()
    out = []
    for v in versions:
        with conn.transaction():
            n = refresh_stats(conn, str(v["id"]))
            if n is None:
                raise SystemExit("The database has no refresh_sample_stats: apply the migrations first.")
            out.append((v["slug"], v["version"], n))
            if dry_run:
                raise psycopg.Rollback()
    return out
