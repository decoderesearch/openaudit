"""The settings of a run, as each attempt and sample keeps them, so that each has its context:
`eval_attempt.settings`, and `eval_sample.metadata.settings` by run id. They have the eval version,
the tested model and its route, the model of each slot (judges and other roles), the generation
settings and the version's metrics. A log can give a sample's own settings in the sample metadata
key `openauditSettings` (WorkspaceBench: the family's judge and summarizer); they go in `sample`."""

from typing import Any

import psycopg

from .store import jsonb

SAMPLE_KEY = "openauditSettings"
# Run settings that change how the run goes, not what it measures.
OPERATIONAL = {"models", "shardSize", "maxConnections", "capKey"}
# The version's metrics, less their descriptions.
METRIC_KEYS = ("key", "displayName", "score", "aggregation", "direction", "min", "max", "unit", "headline", "safetyDirection")


def drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


def run_settings(conn: psycopg.Connection, run_id: str, *, task: str | None = None, harness: dict | None = None) -> dict[str, Any]:
    """The run's settings from its rows. `task` and `harness`: from the log, in place of the
    run's provenance (which a new import sets last)."""
    r = conn.execute(
        """SELECT r.id, r.route, r.settings, r.origin, r."sourceRunId", r.provenance, e.slug,
             e."displayName" AS eval_name, v.version, v.runner, v.metrics, m.name AS model
           FROM eval_run r JOIN eval e ON e.id = r."evalId" JOIN eval_version v ON v.id = r."evalVersionId"
             JOIN model m ON m.id = r."modelId"
           WHERE r.id = %s""",
        (run_id,),
    ).fetchone()
    if not r:
        raise SystemExit(f"No run {run_id}.")
    settings = r["settings"] or {}
    chosen = settings.get("models") or {}
    roles = [
        drop_none(
            {
                "id": s["id"],
                "label": s.get("label"),
                "role": s.get("role"),
                "scoring": s.get("scoring"),
                "model": (chosen.get(s["id"]) or {}).get("model") or s.get("default"),
                "fallbacks": (chosen.get(s["id"]) or {}).get("fallbacks"),
            }
        )
        for s in (r["runner"] or {}).get("models") or []
    ]
    prov = r["provenance"] or {}
    tool = drop_none({"tool": prov.get("tool"), "version": prov.get("toolVersion")})
    return drop_none(
        {
            "runId": str(r["id"]),
            "eval": {"slug": r["slug"], "name": r["eval_name"], "version": r["version"]},
            "model": drop_none({"name": r["model"], "route": r["route"]}),
            "origin": r["origin"],
            "sourceRunId": str(r["sourceRunId"]) if r["sourceRunId"] else None,
            "roles": roles or None,
            "generation": {k: v for k, v in settings.items() if k not in OPERATIONAL} or None,
            "task": task or prov.get("task"),
            "harness": harness or tool or None,
            "metrics": [{k: m[k] for k in METRIC_KEYS if m.get(k) is not None} for m in r["metrics"] or []] or None,
        }
    )


def attempt_settings(run: dict[str, Any], sample_metadata: dict[str, Any] | None) -> dict[str, Any]:
    """The run's settings with the sample's own (`SAMPLE_KEY`)."""
    own = (sample_metadata or {}).get(SAMPLE_KEY)
    return {**run, "sample": own} if own else run


def save_sample_settings(conn: psycopg.Connection, run_id: str, by_sample: dict[str, dict[str, Any]]) -> None:
    """Sets `metadata.settings[run_id]` of each sample in `by_sample` (sample id -> settings)."""
    if not by_sample:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """UPDATE eval_sample SET metadata = jsonb_set(coalesce(metadata, '{}'), '{settings}',
                 coalesce(metadata -> 'settings', '{}') || jsonb_build_object(%s::text, %s::jsonb))
               WHERE id = %s""",
            [(run_id, jsonb(s), sid) for sid, s in by_sample.items()],
        )


def backfill(conn: psycopg.Connection, run_id: str, samples: bool = True) -> tuple[int, int]:
    """Sets the run's settings on its attempts (each keeps its `sample` part) and, with `samples`,
    on their samples. Returns (attempts, samples)."""
    run = run_settings(conn, run_id)
    with conn.transaction():
        attempts = conn.execute(
            """UPDATE eval_attempt SET settings = %s::jsonb
                 || CASE WHEN settings ? 'sample' THEN jsonb_build_object('sample', settings -> 'sample') ELSE '{}' END
               WHERE "runId" = %s""",
            (jsonb(run), run_id),
        ).rowcount
        if not samples:
            return attempts, 0
        rows = conn.execute(
            """UPDATE eval_sample s SET metadata = jsonb_set(coalesce(s.metadata, '{}'), '{settings}',
                 coalesce(s.metadata -> 'settings', '{}') || jsonb_build_object(%s::text, a.settings))
               FROM (SELECT DISTINCT ON ("evalSampleId") "evalSampleId" AS sid, settings FROM eval_attempt
                     WHERE "runId" = %s AND "evalSampleId" IS NOT NULL ORDER BY "evalSampleId", epoch) a
               WHERE s.id = a.sid""",
            (run_id, run_id),
        ).rowcount
    return attempts, rows


def drop_gone_runs(conn: psycopg.Connection) -> int:
    """Removes the settings of runs that no longer exist from the samples. Returns the samples."""
    return conn.execute(
        """UPDATE eval_sample s SET metadata = jsonb_set(s.metadata, '{settings}',
             coalesce((SELECT jsonb_object_agg(k, v) FROM jsonb_each(s.metadata -> 'settings') AS e(k, v)
                       WHERE EXISTS (SELECT 1 FROM eval_run r WHERE r.id::text = e.k)), '{}'))
           WHERE s.metadata ? 'settings'
             AND EXISTS (SELECT 1 FROM jsonb_object_keys(s.metadata -> 'settings') k
                         WHERE NOT EXISTS (SELECT 1 FROM eval_run r WHERE r.id::text = k))"""
    ).rowcount
