"""Takes one subset out of an eval's shown runs: the run's log without the subset's samples, with
its metrics computed again, then imported again (`import_log`, which keeps the other attempts'
ids) and its public copy made again. The original log stays in R2 under `backup/`. Runs of the
task leave the subset out from now on (`work.SKIP_SAMPLES`).

    uv run python scripts/drop_subset.py abstentionbench GPQA            # counts only
    uv run python scripts/drop_subset.py abstentionbench GPQA --apply    # all the runs
    uv run python scripts/drop_subset.py abstentionbench GPQA --apply --run <id>
"""

import argparse
import tempfile
from pathlib import Path
from typing import Any

from inspect_ai._eval.score import (
    metrics_from_log_header,
    reducers_from_log_header,
    resolve_scorers_info,
)
from inspect_ai._eval.task.results import eval_results
from inspect_ai._util.entrypoints import ensure_entry_points
from inspect_ai.log import EvalLog, read_eval_log, write_eval_log
from inspect_ai.scorer import SampleScore

from openaudit_runner.env import load_env
from openaudit_runner.ingest import LOG_TYPE, import_log
from openaudit_runner.redact import redact_runs
from openaudit_runner.store import Bucket, Db, connect


def runs(db: Db, slug: str, subset: str, run_id: str | None) -> list[dict[str, Any]]:
    """The eval's shown, finished runs with a log and attempts in the subset."""
    return db.execute(
        """SELECT r.id, r.origin, r."logKey", r."finishedAt", m.name AS model,
             count(*) FILTER (WHERE a."sampleId" LIKE %s) AS drop, count(*) AS attempts
           FROM eval_run r JOIN eval e ON e.id = r."evalId" JOIN model m ON m.id = r."modelId"
           JOIN eval_attempt a ON a."runId" = r.id
           WHERE e.slug = %s AND r.visibility IN ('public', 'unlisted') AND r."logKey" IS NOT NULL
             AND r.status IN ('succeeded', 'failed', 'cancelled') AND (%s::uuid IS NULL OR r.id = %s::uuid)
           GROUP BY r.id, m.name HAVING count(*) FILTER (WHERE a."sampleId" LIKE %s) > 0
           ORDER BY r."createdAt" """,
        (f"{subset}\\_%", slug, run_id, run_id, f"{subset}\\_%"),
    ).fetchall()


def without_subset(log: EvalLog, subset: str) -> int:
    """Leaves out the subset's samples and computes the metrics again from the others, as
    `work.merge_shards` does. Returns the count left out."""
    keep = [s for s in log.samples or [] if (s.metadata or {}).get("dataset_name") != subset]
    gone = {s.id for s in log.samples or []} - {s.id for s in keep}
    log.samples = keep
    log.eval.dataset.sample_ids = [i for i in log.eval.dataset.sample_ids or [] if i not in gone]
    log.eval.dataset.samples = len({s.id for s in keep})
    for r in log.reductions or []:
        r.samples = [s for s in r.samples if s.sample_id not in gone]
    scores = [
        {k: SampleScore(score=v, sample_id=s.id, sample_metadata=s.metadata) for k, v in s.scores.items()}
        for s in keep
        if s.scores
    ]
    ensure_entry_points()
    old = log.results
    log.results, _ = eval_results(
        samples=len(keep),
        scores=scores,
        reducers=reducers_from_log_header(log),
        scorers=resolve_scorers_info(log),
        metrics=metrics_from_log_header(log),
        early_stopping=old.early_stopping if old else None,
        metadata=old.metadata if old else None,
        logged_samples=len(keep),
        completed_samples=sum(s.error is None for s in keep),
        headline_metric=log.eval.headline_metric,
    )
    return len(gone)


def drop(db: Db, bucket: Bucket, run: dict[str, Any], subset: str) -> None:
    run_id = str(run["id"])
    with tempfile.TemporaryDirectory() as tmp:
        src, out = Path(tmp) / "log.eval", Path(tmp) / "without.eval"
        body = bucket.get(run["logKey"])
        bucket.put(f"runs/{run_id}/backup/log-with-{subset.lower()}.eval", body, LOG_TYPE)
        src.write_bytes(body)
        del body
        log = read_eval_log(str(src))
        gone = without_subset(log, subset)
        write_eval_log(log, str(out))
        del log
        with connect() as conn:
            import_log(conn, bucket, out, run_id=run_id)
            conn.execute(
                """UPDATE eval_run SET "finishedAt" = %s, "redactedBytes" = CASE WHEN "redactedKey" = "logKey"
                     THEN "logBytes" ELSE "redactedBytes" END WHERE id = %s""",
                (run["finishedAt"], run_id),
            )
    print(f"  {run_id} {run['model']}: left out {gone} samples.", flush=True)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("eval_slug")
    p.add_argument("subset", help="The samples' `dataset_name`, also their id prefix.")
    p.add_argument("--run", dest="run_id")
    p.add_argument("--apply", action="store_true")
    args = p.parse_args()
    load_env()
    bucket = Bucket()
    with Db() as db:
        found = runs(db, args.eval_slug, args.subset, args.run_id)
        for r in found:
            print(f"  {r['id']} {r['origin']:7} {r['model']:40} {r['drop']:3} of {r['attempts']}", flush=True)
        print(f"{len(found)} runs, {sum(r['drop'] for r in found)} attempts to leave out.", flush=True)
        if not args.apply:
            return
        done = []
        for r in found:
            drop(db, bucket, r, args.subset)
            done.append(str(r["id"]))
        if done:
            print(f"Redacted logs: {redact_runs(db, bucket, done)}", flush=True)


if __name__ == "__main__":
    main()
