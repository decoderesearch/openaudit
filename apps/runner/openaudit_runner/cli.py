"""openaudit-runner: work, import, enqueue, rescore, apply-terms, apply-hazards, redact-logs,
sample-stats, delete-run-files."""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any

from uuid6 import uuid7

from .env import ROOT, load_env
from .errors import start_sentry
from .store import jsonb

WEB = ROOT / "apps" / "web"
SLOT_HELP = (
    "A slot's model through OpenRouter, as slot=model (judge=openai/gpt-4o). "
    "Default: the slot's tier (spec/model-ladders.yaml), else the slot's default."
)


def task_args(pairs: list[str]) -> dict[str, Any]:
    import yaml

    out = {}
    for pair in pairs:
        key, eq, value = pair.partition("=")
        if not eq:
            raise SystemExit(f"Give the task arg as key=value, not {pair!r}.")
        out[key] = yaml.safe_load(value)
    return out


def model_route(model: str) -> dict[str, Any]:
    """The model's route, from the web app's rule (`pnpm routes:check --json`)."""
    import subprocess

    done = subprocess.run(
        ["pnpm", "exec", "tsx", "scripts/routes.ts", "--json", model],
        cwd=WEB,
        capture_output=True,
        text=True,
    )
    if done.returncode != 0:
        raise SystemExit(done.stderr.strip() or f"Could not get the route for {model}.")
    route = json.loads(done.stdout.strip().splitlines()[-1])
    if not route:
        raise SystemExit(
            f"No route for {model}. See `pnpm routes:check {model}` in apps/web."
        )
    return route


def slot_routes(
    slots: list[dict[str, Any]],
    chosen: list[str],
    target: str,
    base: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """The route for each slot: the chosen model, else `base`, else the slot's tier model for
    the target, else the slot's default."""
    from .ladders import slot_ok
    from .work import slot_routes as resolve

    picks = dict(c.split("=", 1) for c in chosen)
    if unknown := set(picks) - {s["id"] for s in slots}:
        raise SystemExit(
            f"No slots {sorted(unknown)}. Slots: {[s['id'] for s in slots]}."
        )
    for s in slots:
        if s["id"] in picks and not slot_ok(s, picks[s["id"]], target):
            print(
                f"Note: {picks[s['id']]} is not good enough for slot {s['id']} by the "
                "tier rules, so model cards do not use this run.",
                file=sys.stderr,
            )
    routes = resolve(
        [s for s in slots if s["id"] not in picks], {"models": base or {}}, target
    )
    return {
        s["id"]: {"kind": "openrouter", "model": picks[s["id"]], "allowFallbacks": True}
        if s["id"] in picks
        else routes[s["id"]]
        for s in slots
    }


def refuse_dated(conn: Any, eval_id: str) -> None:
    """Stops when the eval is legacy or saturated: they keep their old runs, but get no new ones."""
    row = conn.execute("SELECT slug, status FROM eval WHERE id = %s", (eval_id,)).fetchone()
    if row and row["status"] != "active":
        raise SystemExit(f"{row['slug']} is {row['status']}. New runs are off.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="openaudit-runner")
    sub = parser.add_subparsers(dest="command", required=True)

    w = sub.add_parser("work", help="Run queued evals.")
    w.add_argument(
        "--once", action="store_true", help="Run at most one queued eval, then stop."
    )
    w.add_argument(
        "--poll", type=float, default=5.0, help="Seconds between checks for new runs."
    )
    w.add_argument("--run", help="Do only this run's work (plan, shards, merge).")
    w.add_argument(
        "--exit-when-idle",
        action="store_true",
        help="Stop when there is no work. With --run, first wait while caps are full.",
    )
    w.add_argument(
        "--standby",
        action="store_true",
        default=os.environ.get("OPENAUDIT_STANDBY") == "1",
        help="With --run and --exit-when-idle, also wait while other runners have shards of"
        " the run, to take a shard whose runner stops. Default: OPENAUDIT_STANDBY=1.",
    )

    i = sub.add_parser("import", help="Import an Inspect .eval log.")
    i.add_argument("file", type=Path)
    i.add_argument("--model", help="Our model name, for example Qwen/Qwen3.6-27B.")
    i.add_argument(
        "--eval",
        dest="eval_slug",
        help="Eval slug. Default: the eval whose runner runs the log's task.",
    )
    i.add_argument(
        "--run-id", help="Import into this run (replaces its attempts and results)."
    )
    i.add_argument(
        "--visibility", default="public", choices=["private", "unlisted", "public"]
    )

    e = sub.add_parser("enqueue", help="Queue a run, as the web Run button does.")
    e.add_argument("--model", required=True)
    e.add_argument("--eval", dest="eval_slug", required=True)
    e.add_argument(
        "--reasoning",
        choices=["none", "minimal", "low", "medium", "high", "xhigh", "max", "on"],
        default="none",
        help="Thinking effort, in OpenRouter's words. on: the model's default.",
    )
    e.add_argument(
        "--direct",
        metavar="INSPECT_MODEL",
        help="Call the target directly with this Inspect model name "
        "(vllm/Qwen/Qwen3.6-27B, with VLLM_BASE_URL), not through OpenRouter.",
    )
    e.add_argument(
        "--cap-key",
        help="The runner_cap key for the run's shards (one cap per vLLM server). "
        "Default: from the route.",
    )
    e.add_argument("--limit", type=int)
    e.add_argument(
        "--route-model",
        help="Another OpenRouter id for the route's model (a tier of the same model).",
    )
    e.add_argument("--max-tokens", type=int)
    e.add_argument(
        "--epochs",
        type=int,
        help="Tries of each sample. Default: the eval's defaultTrials, else 1.",
    )
    e.add_argument("--shard-size", type=int, help="Samples in each shard.")
    e.add_argument(
        "--max-connections", type=int, help="Parallel model calls in each shard."
    )
    e.add_argument("--slot", action="append", default=[], help=SLOT_HELP)
    e.add_argument(
        "--visibility",
        default="public",
        choices=["private", "unlisted", "public"],
        help="Use private for a trial.",
    )
    e.add_argument(
        "-T",
        dest="task_args",
        action="append",
        default=[],
        help="A task arg as key=value (subset=mcq_set). The value is read as YAML.",
    )

    r = sub.add_parser("rescore", help="Queue a re-score of a run with other judges.")
    r.add_argument("run_id")
    r.add_argument("--slot", action="append", default=[], help=SLOT_HELP)
    r.add_argument(
        "--limit", type=int, help="Score only the first samples of the source log."
    )
    r.add_argument(
        "--visibility",
        choices=["private", "unlisted", "public"],
        help="Default: the source run's. Use private for a trial.",
    )

    t = sub.add_parser(
        "apply-terms", help="Set subset rules again on an eval's runs, from their logs."
    )
    t.add_argument("eval_slug")

    h = sub.add_parser(
        "apply-hazards", help="Set hazard levels again on an eval's attempts, from their logs."
    )
    h.add_argument("eval_slug")
    h.add_argument("--dry-run", action="store_true", help="Count the changes; write nothing.")

    x = sub.add_parser(
        "retranscribe",
        help="Write the transcripts of an eval's finished runs again, from their logs.",
    )
    x.add_argument("eval_slug")
    x.add_argument("--run", dest="run_id", help="Only this run.")
    x.add_argument("--no-rebuild", action="store_true", help="Do not queue the cards to build again.")
    x.add_argument("--keep-flags", action="store_true", help="Do not make the flagger check them again.")
    x.add_argument("--dry-run", action="store_true", help="Compare with the stored transcripts; write nothing.")

    d = sub.add_parser(
        "redact-logs",
        help="Make the public copies of run logs whose attempts to leave out changed.",
    )
    d.add_argument("--run", dest="run_id", help="Only this run.")
    d.add_argument("--dry-run", action="store_true", help="Count the copies to make; write nothing.")

    s = sub.add_parser(
        "sample-stats",
        help="Set the graded and failed replies of each sample again, for the eval page's order.",
    )
    s.add_argument("eval_slug", nargs="?", help="Only this eval.")
    s.add_argument("--dry-run", action="store_true", help="Count the samples that change; write nothing.")

    g = sub.add_parser(
        "attempt-settings",
        help="Set the run's settings again on each attempt and sample, from the run's rows.",
    )
    g.add_argument("--run", dest="run_id", help="Only this run. Default: all runs.")
    g.add_argument("--dry-run", action="store_true", help="Count the runs and attempts; write nothing.")
    g.add_argument("--no-samples", action="store_true", help="Set the attempts only, not the samples.")

    f = sub.add_parser(
        "delete-run-files",
        help="Delete runs' R2 files that no database links. Dev and production share them.",
    )
    f.add_argument("run_ids", nargs="+")
    f.add_argument("--apply", action="store_true", help="Delete. Default: show what goes.")

    c = sub.add_parser(
        "cards", add_help=False, help="OpenAudit Cards: build, watch or drain."
    )
    c.add_argument("rest", nargs=argparse.REMAINDER)

    args = parser.parse_args()
    start_sentry()
    if args.command == "cards":
        from .cards import main as cards_main

        cards_main(args.rest)
        return
    load_env()
    from .store import Bucket, connect

    if args.command == "work":
        from .work import work

        work(
            once=args.once,
            poll=args.poll,
            run_id=args.run,
            exit_when_idle=args.exit_when_idle,
            standby=args.standby,
        )
    elif args.command == "import":
        from .ingest import import_log

        with connect() as conn:
            import_log(
                conn,
                Bucket(),
                args.file,
                run_id=args.run_id,
                model_name=args.model,
                eval_slug=args.eval_slug,
                visibility=args.visibility,
            )
    elif args.command == "enqueue":
        from .ingest import find_eval, find_model

        route = (
            {"kind": "direct", "model": args.direct}
            if args.direct
            else model_route(args.model)
        )
        if args.route_model:
            route = {**route, "model": args.route_model}
        settings = {
            "reasoning": args.reasoning,
            **({"limit": args.limit} if args.limit else {}),
            **({"maxTokens": args.max_tokens} if args.max_tokens else {}),
            **({"capKey": args.cap_key} if args.cap_key else {}),
            **({"shardSize": args.shard_size} if args.shard_size else {}),
            **(
                {"maxConnections": args.max_connections} if args.max_connections else {}
            ),
            **({"taskArgs": task_args(args.task_args)} if args.task_args else {}),
        }
        with connect() as conn:
            found = find_eval(conn, "", args.eval_slug)
            refuse_dated(conn, found["evalId"])
            runner = conn.execute(
                "SELECT runner FROM eval_version WHERE id = %s", (found["versionId"],)
            ).fetchone()["runner"]
            epochs = args.epochs or (runner or {}).get("defaultTrials") or 1
            if epochs > 1:
                settings["epochs"] = epochs
            if slots := (runner or {}).get("models"):
                from .auditor import check_auditors

                try:
                    settings["models"] = check_auditors(
                        slots,
                        slot_routes(slots, args.slot, route["model"]),
                        route["model"],
                        {c.split("=", 1)[0] for c in args.slot},
                    )
                except ValueError as e:
                    raise SystemExit(str(e)) from None
            run_id = str(uuid7())
            conn.execute(
                """INSERT INTO eval_run (id, "evalId", "evalVersionId", "modelId", origin, status, route, settings,
                     visibility, "updatedAt")
                   VALUES (%s, %s, %s, %s, 'run', 'queued', %s, %s, %s, now())""",
                (
                    run_id,
                    found["evalId"],
                    found["versionId"],
                    find_model(conn, args.model),
                    jsonb(route),
                    jsonb(settings),
                    args.visibility,
                ),
            )
        print(f"Queued run {run_id}.")
    elif args.command == "rescore":
        with connect() as conn:
            source = conn.execute(
                """SELECT r.*, v.runner FROM eval_run r JOIN eval_version v ON v.id = r."evalVersionId"
                   WHERE r.id = %s""",
                (args.run_id,),
            ).fetchone()
            if not source or not source["logKey"]:
                raise SystemExit(f"No run {args.run_id} with a log.")
            refuse_dated(conn, source["evalId"])
            slots = (source["runner"] or {}).get("models") or []
            scoring = [s for s in slots if s.get("scoring")]
            if not scoring:
                raise SystemExit("This eval has no judges that a re-score can change.")
            if fixed := {c.split("=", 1)[0] for c in args.slot} - {
                s["id"] for s in scoring
            }:
                raise SystemExit(f"A re-score cannot change {sorted(fixed)}.")
            old = source["settings"].get("models") or {}
            untiered = {s["id"] for s in scoring if not s.get("tier")}
            settings = {
                **source["settings"],
                "models": {
                    **old,
                    **slot_routes(
                        scoring,
                        args.slot,
                        source["route"]["model"],
                        {k: v for k, v in old.items() if k in untiered},
                    ),
                },
                **({"limit": args.limit} if args.limit else {}),
            }
            run_id = str(uuid7())
            conn.execute(
                """INSERT INTO eval_run (id, "evalId", "evalVersionId", "modelId", origin, "sourceRunId", status,
                     route, settings, visibility, "updatedAt")
                   VALUES (%s, %s, %s, %s, 'rescore', %s, 'queued', %s, %s, %s, now())""",
                (
                    run_id,
                    source["evalId"],
                    source["evalVersionId"],
                    source["modelId"],
                    source["id"],
                    jsonb(source["route"]),
                    jsonb(settings),
                    args.visibility or source["visibility"],
                ),
            )
        print(f"Queued re-score {run_id}.")
    elif args.command == "apply-terms":
        from .ingest import apply_terms

        with connect() as conn:
            print(f"Changed {apply_terms(conn, Bucket(), args.eval_slug)} attempts.")
    elif args.command == "apply-hazards":
        from .ingest import apply_hazards

        with connect() as conn:
            changes = apply_hazards(conn, Bucket(), args.eval_slug, dry_run=args.dry_run)
        verb = "Would change" if args.dry_run else "Changed"
        print(f"{verb} {changes.total()} attempts.")
        for (old, new), n in changes.most_common():
            print(f"  {old or 'open'} -> {new or 'open'}: {n}")
    elif args.command == "retranscribe":
        from .ingest import retranscribe

        with connect() as conn:
            n = retranscribe(
                conn,
                Bucket(),
                args.eval_slug,
                args.run_id,
                rebuild=not args.no_rebuild,
                recheck=not args.keep_flags,
                dry_run=args.dry_run,
            )
            print(f"{'Compared' if args.dry_run else 'Wrote'} {n} transcripts.")
    elif args.command == "redact-logs":
        from .redact import redact_runs, stale_runs
        from .store import Db

        with Db() as db:
            if args.dry_run:
                stale = stale_runs(db, [args.run_id] if args.run_id else None)
                print(f"Would make {len(stale)} copies: {sum(1 for _, n in stale if n)} leave out attempts.")
                for run_id, n in stale:
                    print(f"  {run_id}: {n} left out")
            else:
                print(f"Redacted logs: {redact_runs(db, Bucket(), [args.run_id] if args.run_id else None)}")
    elif args.command == "attempt-settings":
        from .attempt_settings import backfill, drop_gone_runs

        with connect() as conn:
            where, params = ("WHERE r.id = %s", (args.run_id,)) if args.run_id else ("", ())
            runs = conn.execute(
                f"""SELECT r.id::text AS id, count(a.id) AS n FROM eval_run r
                      LEFT JOIN eval_attempt a ON a."runId" = r.id {where} GROUP BY r.id ORDER BY r.id""",
                params,
            ).fetchall()
            if args.dry_run:
                print(f"Would set {sum(r['n'] for r in runs)} attempts in {len(runs)} runs.")
                return
            attempts = samples = 0
            for i, r in enumerate(runs, start=1):
                a, s = backfill(conn, r["id"], samples=not args.no_samples)
                attempts, samples = attempts + a, samples + s
                if i % 25 == 0 or i == len(runs):
                    print(f"  {i}/{len(runs)} runs: {attempts} attempts, {samples} sample rows", flush=True)
            gone = 0 if args.run_id or args.no_samples else drop_gone_runs(conn)
        print(f"Set {attempts} attempts and {samples} sample rows in {len(runs)} runs; {gone} samples lose gone runs.")
    elif args.command == "delete-run-files":
        from .run_files import delete_run_files

        n = delete_run_files(Bucket(), args.run_ids, apply=args.apply)
        print(f"{'Deleted' if args.apply else 'Would delete'} {n} files.")
    elif args.command == "sample-stats":
        from .samples import refresh_all_stats

        with connect() as conn:
            done = refresh_all_stats(conn, args.eval_slug, dry_run=args.dry_run)
        for slug, version, n in done:
            if n:
                print(f"  {slug} {version}: {n}")
        verb = "Would change" if args.dry_run else "Changed"
        print(f"{verb} {sum(n for *_, n in done)} samples in {len(done)} versions.")


if __name__ == "__main__":
    main()
