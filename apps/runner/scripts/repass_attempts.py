"""Sets the `passed` of stored attempts again by `inspect_map.attempt_passed`: the `pass` rule or
the direction of the headline score in the seed.

    uv run python scripts/repass_attempts.py            # show the changes only
    uv run python scripts/repass_attempts.py --apply    # write them
    uv run python scripts/repass_attempts.py --eval agentharm   # one eval only
    uv run python scripts/repass_attempts.py --skip-run <id>    # not this run (can repeat)

The headline score is the only plain score of the attempts (no `/` or `@`), else the plain score
of the headline metric, else the sub-score (`scorer/name`) that `inspect_map.pass_key` picks.
"""

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

from openaudit_runner import inspect_map as im
from openaudit_runner.env import load_env
from openaudit_runner.store import connect

SEEDS = Path(__file__).resolve().parents[3] / "data" / "seed" / "evals"
BATCH = 5000


def headline_key(keys: list[str], version: dict[str, Any]) -> str | None:
    plain = [k for k in keys if "/" not in k and "@" not in k]
    if len(plain) == 1:
        return plain[0]
    metric = next((m for m in version["metrics"] if m.get("headline")), {})
    defs = version.get("scores", [])
    d = next((s for s in defs if s["key"] == metric.get("score")), None)
    found = next((k for k in plain if d and im.score_def([d], k)), None)
    scorers = dict.fromkeys(k.split("/")[0] for k in keys if "/" in k and "@" not in k)
    subs = (im.pass_key(keys, s, defs, version["metrics"]) for s in scorers)
    return found or next((k for k in subs if k), None)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--eval", help="the slug of the one eval to change")
    ap.add_argument("--skip-run", action="append", default=[], help="a run id not to change")
    args = ap.parse_args()
    load_env()

    seeds: dict[tuple[str, str], dict[str, Any]] = {}
    for p in SEEDS.glob("*.json"):
        seed = json.loads(p.read_text())
        for v in seed["versions"]:
            if (v.get("runner") or {}).get("task"):
                seeds[(seed["eval"]["slug"], v["version"])] = v

    conn = connect()
    versions = conn.execute(
        """SELECT v.id, v.version, e.slug FROM eval_version v JOIN eval e ON e.id = v."evalId"
           WHERE EXISTS (SELECT 1 FROM eval_run r JOIN eval_attempt a ON a."runId" = r.id
                         WHERE r."evalVersionId" = v.id)
             AND (%s::text IS NULL OR e.slug = %s)
           ORDER BY e.slug""",
        (args.eval, args.eval),
    ).fetchall()
    counts: Counter[tuple[str, bool | None, bool | None]] = Counter()
    for found in versions:
        name = f"{found['slug']} {found['version']}"
        seed = seeds.get((found["slug"], found["version"]))
        if not seed:
            print(f"  {name}: no runner in the seed, not changed")
            continue
        keys = [
            r["k"]
            for r in conn.execute(
                """SELECT DISTINCT jsonb_object_keys(a.scores) k FROM eval_attempt a
                   JOIN eval_run r ON r.id = a."runId" WHERE r."evalVersionId" = %s""",
                (found["id"],),
            )
        ]
        defs = seed.get("scores", [])
        key = headline_key(keys, seed)
        rows = conn.execute(
            """SELECT a.id, a."runId", a.scores -> %s -> 'value' AS value, a.target, a.passed,
                      a.metrics
               FROM eval_attempt a JOIN eval_run r ON r.id = a."runId"
               WHERE r."evalVersionId" = %s AND NOT r.id = ANY(%s::uuid[])""",
            (key or "", found["id"], args.skip_run),
        ).fetchall()
        changes, runs = [], set()
        for r in rows:
            new = (
                im.attempt_passed(r["value"], key, defs, r["target"], r["metrics"])
                if key and r["value"] is not None
                else None
            )
            if new != r["passed"]:
                changes.append((r["id"], new))
                runs.add(r["runId"])
                counts[(found["slug"], r["passed"], new)] += 1
        print(f"  {name}: headline {key}, {len(changes)} of {len(rows)} change")
        if not args.apply or not changes:
            continue
        with conn.transaction(), conn.cursor() as cur:
            for i in range(0, len(changes), BATCH):
                part = changes[i : i + BATCH]
                cur.execute(
                    """UPDATE eval_attempt a SET passed = u.p
                       FROM unnest(%s::uuid[], %s::boolean[]) AS u(id, p) WHERE a.id = u.id""",
                    ([c[0] for c in part], [c[1] for c in part]),
                )
            cur.execute(
                'UPDATE eval_run SET "updatedAt" = now() WHERE id = ANY(%s::uuid[])',
                (list(runs),),
            )
            cur.execute("SELECT refresh_sample_stats(%s)", (found["id"],))

    print(f"{sum(counts.values())} attempts change (old -> new):")
    for (slug, old, new), n in sorted(counts.items(), key=str):
        print(f"  {slug}: {old} -> {new}: {n}")
    if args.apply:
        print("Done.")


if __name__ == "__main__":
    main()
