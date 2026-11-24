"""Imports an Inspect log: the file and each transcript to R2, then the run, attempts and results
to Postgres in one transaction. The same file twice does nothing; the same run again replaces.
Samples are read one at a time, so memory does not grow with the sample count.

Dev and production share the R2 bucket, and sync copies runs with their keys. So an R2 key has a
content hash, and a write never changes an object that a database links."""

import functools
import hashlib
import itertools
import json
import socket
import sys
import tempfile
import urllib.request
import zipfile
from collections import Counter
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import openaudit_spec as spec
import psycopg
from inspect_ai.log import EvalLog, EvalSample, read_eval_log
from inspect_ai.log._recorders.eval import _parse_sample_data, _read_header
from uuid6 import uuid7

from . import __version__, ladders
from . import inspect_map as im
from .attempt_settings import attempt_settings, run_settings, save_sample_settings
from .hazard import hazard
from .samples import Key as SampleKey
from .samples import refresh_stats, sample_key, save_samples
from .store import Bucket, connect, json_bytes, jsonb

LOG_TYPE = "application/zip"
SAMPLES = "samples/"
# Attempts in each insert. The transaction must not be idle for 5 minutes (Neon's
# `idle_in_transaction_session_timeout`).
BATCH = 200


class RunCancelled(Exception):
    """The run is cancelled. The import writes nothing to it."""


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def body_key(prefix: str, attempt_id: str, body: Any) -> str:
    digest = hashlib.sha256(json_bytes(body)).hexdigest()[:16]
    return f"{prefix}attempts/{attempt_id}-{digest}.json"


def claim_key(digest: str) -> str:
    """The R2 object that names the run of a log, for each database."""
    return f"imports/{digest}.json"


def refuse_other_import(bucket: Bucket, digest: str) -> None:
    """Stops a new import of a log that a run in another database has. Sync copies that run
    with its id and keys; a second import makes a run with another id."""
    claim = bucket.get_or_none(claim_key(digest))
    other = json.loads(claim)["runId"] if claim else None
    if other and bucket.has_prefix(f"runs/{other}/"):
        raise SystemExit(
            f"Run {other} in another database has this log. To put it on production, use "
            "/admin/sync on the local server; do not import it again."
        )


def drop_none(d: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in d.items() if v is not None}


def route_from_log(log: EvalLog) -> dict[str, Any]:
    """The serving route as the log's model name and model args state it."""
    prefix, _, rest = log.eval.model.partition("/")
    args = log.eval.model_args or {}
    if prefix == "openrouter":
        provider = args.get("provider") or {}
        return drop_none(
            {
                "kind": "openrouter",
                "model": rest,
                "providers": provider.get("order"),
                "allowFallbacks": provider.get("allow_fallbacks"),
                "quantization": (provider.get("quantizations") or ["unknown"])[0],
            }
        )
    return {"kind": "direct", "model": log.eval.model}


def effort_from_log(log: EvalLog) -> str | None:
    """The target's thinking effort, as `work.thinking` sends it. None: the log sets none."""
    generate = log.eval.model_generate_config
    enabled = (log.eval.model_args or {}).get("reasoning_enabled")
    if enabled is False:
        return "none"
    body = (generate.extra_body if generate else None) or {}
    template = (body.get("chat_template_kwargs") or {}).get("enable_thinking")
    if template is not None:
        return "on" if template else "none"
    extra = body.get("reasoning") or {}
    effort = extra.get("effort") or (generate.reasoning_effort if generate else None)
    return effort or ("on" if enabled else None)


def settings_from_log(log: EvalLog) -> dict[str, Any]:
    config = log.eval.config
    generate = log.eval.model_generate_config
    return drop_none(
        {
            "reasoning": effort_from_log(log),
            "limit": config.limit if isinstance(config.limit, int) else None,
            "epochs": config.epochs if config.epochs and config.epochs > 1 else None,
            "maxConnections": generate.max_connections if generate else None,
            "temperature": generate.temperature if generate else None,
            "maxTokens": generate.max_tokens if generate else None,
            "taskArgs": log.eval.task_args or None,
        }
    )


def other_models(
    settings: dict[str, Any],
    slots: list[dict[str, Any]],
    fallbacks: list[dict[str, Any]] | None = None,
) -> str | None:
    """`slot: model` pairs in the version's slot order, for `ResultSettings.otherModels`, with
    the calls that fallback models made (`judge: a/x (fallback b/y: 3 calls)`)."""
    models = settings.get("models") or {}
    pairs = []
    for s in slots:
        if s["id"] not in models:
            continue
        used = [
            f"fallback {f['model']}: {f['calls']} call{'s' if f['calls'] > 1 else ''}"
            for f in fallbacks or []
            if f["slot"] == s["id"]
        ]
        extra = f" ({', '.join(used)})" if used else ""
        pairs.append(f"{s['id']}: {models[s['id']]['model']}{extra}")
    return ", ".join(pairs) or None


def fallback_calls(
    sample: Any, slots: list[dict[str, Any]], settings: dict[str, Any]
) -> Counter[tuple[str, str]]:
    """The sample's calls by a slot's fallback models, by (slot, model). A slot model's role is
    the slot's Inspect role, else the slot id (`work.slot_inputs`)."""
    models = settings.get("models") or {}
    by_role = {
        s.get("inspectRole") or s["id"]: s["id"]
        for s in slots
        if (models.get(s["id"]) or {}).get("fallbacks")
    }
    out: Counter[tuple[str, str]] = Counter()
    for e in sample.events or []:
        if e.event != "model" or e.error or e.role not in by_role:
            continue
        sid = by_role[e.role]
        name = ladders.model_id(e.model)
        if name in {m.lower() for m in models[sid]["fallbacks"]}:
            out[(sid, name)] += 1
    return out


def result_settings(
    route: dict[str, Any],
    settings: dict[str, Any],
    total: int | None,
    slots: list[dict[str, Any]],
    fallbacks: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    reasoning = settings.get("reasoning")
    limit = settings.get("limit")
    return drop_none(
        {
            "reasoningEffort": "none" if reasoning == "off" else reasoning,
            "harness": "Inspect",
            "surface": None if route["kind"] == "engine" else "API",
            "otherModels": other_models(settings, slots, fallbacks),
            "trials": settings.get("epochs"),
            "other": f"First {limit} of {total} samples"
            if limit and total and limit < total
            else None,
        }
    )


@functools.cache
def openrouter_prices() -> dict[str, tuple[float, float, float, float]]:
    """OpenRouter list prices in dollars per token: model id to (input, output, cache read,
    cache write). A model with no cache price has its input price there."""
    with urllib.request.urlopen("https://openrouter.ai/api/v1/models", timeout=30) as r:
        data = json.load(r)["data"]
    out = {}
    for m in data:
        if p := m.get("pricing"):
            prompt = float(p["prompt"])
            out[m["id"]] = (
                prompt,
                float(p["completion"]),
                float(p.get("input_cache_read") or prompt),
                float(p.get("input_cache_write") or prompt),
            )
    return out


def estimate_cost(name: str, tokens: dict[str, int]) -> float | None:
    """List price times tokens, for calls whose route did not state a cost. `cacheRead` and
    `cacheWrite` are part of `input`."""
    prefix, _, model = name.partition("/")
    if prefix != "openrouter":
        return None
    try:
        price = openrouter_prices().get(model)
    except OSError:
        return None
    if not price:
        return None
    read, write = tokens.get("cacheRead", 0), tokens.get("cacheWrite", 0)
    return (
        (tokens["input"] - read - write) * price[0]
        + tokens["output"] * price[1]
        + read * price[2]
        + write * price[3]
    )


def model_usage(
    by_model: dict[str, dict[str, Any]], target: str, rescore: bool
) -> dict[str, dict[str, Any]]:
    """`RunProvenance.byModel`. A re-score keeps only the models it called."""
    out = {}
    for name, m in by_model.items():
        if rescore and name == target:
            continue
        cost, estimated = m["costUsd"], None
        if not cost and any(m["tokens"].values()):
            cost = estimate_cost(name, m["tokens"]) or 0.0
            estimated = True if cost else None
        out[name] = drop_none(
            {
                "tokens": m["tokens"],
                "costUsd": round(cost, 6) if cost else None,
                "costEstimated": estimated,
                "servedBy": sorted(m["servedBy"]) or None,
            }
        )
    return out


def scoring_roles(slots: list[dict[str, Any]]) -> set[str]:
    """The roles of the slots that a re-score changes (see `fallback_calls`)."""
    return {s.get("inspectRole") or s["id"] for s in slots if s.get("scoring")}


def role_usage(
    by_role: dict[str, dict[str, Any]], rescore: bool, keep: set[str] = frozenset()
) -> dict[str, dict[str, Any]]:
    """`RunProvenance.byRole`. A re-score keeps only its judges (`keep`, or a `judge` role); its
    log keeps the old calls of the other roles."""
    return {
        role: drop_none(
            {
                "tokens": {k: v for k, v in r["tokens"].items() if v},
                "costUsd": round(r["costUsd"], 6) if r["costUsd"] else None,
            }
        )
        for role, r in by_role.items()
        if not rescore or role in keep or role.startswith("judge")
    }


def find_eval(conn: psycopg.Connection, task: str, slug: str | None) -> dict[str, Any]:
    """The eval version whose runner runs `task`, or the newest published version of `slug`."""
    rows = conn.execute(
        """SELECT v.id AS "versionId", e.id AS "evalId", e.slug FROM eval_version v JOIN eval e ON e.id = v."evalId"
           WHERE (%(slug)s::text IS NULL AND v.runner->>'task' = %(task)s) OR e.slug = %(slug)s
           ORDER BY (v.runner->>'task' = %(task)s) DESC NULLS LAST, v.status = 'published' DESC, v."createdAt" DESC""",
        {"task": task, "slug": slug},
    ).fetchall()
    if not rows:
        raise SystemExit(
            f"No eval runs task {task}{f' or has slug {slug}' if slug else ''}. Give --eval."
        )
    return rows[0]


def find_model(conn: psycopg.Connection, name: str) -> str:
    row = conn.execute(
        "SELECT id FROM model WHERE name = %s OR %s = ANY(aliases) ORDER BY source = 'hf' DESC LIMIT 1",
        (name, name),
    ).fetchone()
    if not row:
        raise SystemExit(f"No model named {name}.")
    return str(row["id"])


def capability_direction(conn: psycopg.Connection, eval_id: str) -> str | None:
    """The capability direction of a measured result: the one most reported results of this eval
    have. A measured result's safety direction comes only from its `MetricDef`."""
    row = conn.execute(
        """SELECT mode() WITHIN GROUP (ORDER BY "capabilityDirection") AS c
           FROM eval_result WHERE "evalId" = %s AND origin = 'reported'""",
        (eval_id,),
    ).fetchone()
    return row["c"] if row else None


def sample_members(z: zipfile.ZipFile, log: EvalLog) -> list[str]:
    """The sample members of a `.eval` log in attempt order (as `inspect_map.ordinals`): dataset
    order, then epoch."""
    order = {str(s): i for i, s in enumerate(log.eval.dataset.sample_ids or [])}

    def key(name: str) -> tuple[int, str, int]:
        sid, _, epoch = (
            name.removeprefix(SAMPLES).removesuffix(".json").rpartition("_epoch_")
        )
        return (order.get(sid, len(order)), sid, int(epoch))

    return sorted({n for n in z.namelist() if n.startswith(SAMPLES)}, key=key)


def read_header(path: Path) -> EvalLog:
    """The header of a `.eval` log, with no samples and no reductions. Inspect's header-only read
    also parses `reductions.json`, which has the scores of all the samples."""
    with zipfile.ZipFile(path) as z:
        return _read_header(z, str(path))


def read_sample(z: zipfile.ZipFile, name: str) -> EvalSample:
    return _parse_sample_data(z.read(name))


def log_samples(path: Path, log: EvalLog) -> Iterator[EvalSample]:
    """The samples in attempt order, one at a time. A `.json` log is read whole."""
    if log.samples is not None:
        yield from (s for _, s in im.ordinals(log, log.samples))
        return
    with zipfile.ZipFile(path) as z:
        for name in sample_members(z, log):
            yield read_sample(z, name)


def import_log(
    conn: psycopg.Connection,
    bucket: Bucket,
    path: Path,
    *,
    run_id: str | None = None,
    model_name: str | None = None,
    eval_slug: str | None = None,
    visibility: str = "public",
) -> str:
    digest = sha256(path)
    same = conn.execute(
        'SELECT id FROM eval_run WHERE "logSha256" = %s', (digest,)
    ).fetchone()
    if same and str(same["id"]) != run_id:
        print(f"Already imported as run {same['id']}; nothing to do.")
        return str(same["id"])
    if run_id is None:
        refuse_other_import(bucket, digest)

    # `im.results` reads the samples from the file when the log has none in memory: a zip only.
    log = read_header(path) if zipfile.is_zipfile(path) else read_eval_log(str(path))
    samples = log_samples(path, log)
    first = next(samples, None)
    if first is None:
        raise SystemExit(f"{path} has no samples.")
    samples = itertools.chain([first], samples)

    new = run_id is None
    rescore = False
    if run_id:
        run = conn.execute("SELECT * FROM eval_run WHERE id = %s", (run_id,)).fetchone()
        if not run:
            raise SystemExit(f"No run {run_id}.")
        eval_id, version_id, model_id = (
            str(run["evalId"]),
            str(run["evalVersionId"]),
            str(run["modelId"]),
        )
        route, settings, provenance = (
            run["route"],
            run["settings"],
            dict(run["provenance"] or {}),
        )
        rescore = run["origin"] == "rescore"
    else:
        found = find_eval(conn, log.eval.task, eval_slug)
        eval_id, version_id = str(found["evalId"]), str(found["versionId"])
        if not model_name:
            raise SystemExit(
                "Give --model: the log names a route, not one of our models."
            )
        model_id = find_model(conn, model_name)
        route, settings = route_from_log(log), settings_from_log(log)
        provenance = {"host": socket.gethostname(), "runnerVersion": __version__}
        run_id = str(uuid7())
    version = conn.execute(
        'SELECT runner, "sampleTerms", metrics, scores, dataset FROM eval_version WHERE id = %s',
        (version_id,),
    ).fetchone()
    splits = (version.get("dataset") or {}).get("splits") or []
    slots = (version["runner"] or {}).get("models") or []
    if new and slots:
        settings["models"] = im.slot_models(log, slots)
        args = {
            k: v
            for k, v in (settings.get("taskArgs") or {}).items()
            if k not in {s.get("taskArg") for s in slots}
        }
        settings = {k: v for k, v in settings.items() if k != "taskArgs"} | (
            {"taskArgs": args} if args else {}
        )

    prefix = f"runs/{run_id}/"
    log_key = f"{prefix}log-{digest[:16]}.eval"
    old = {
        (r["sampleId"], r["epoch"]): str(r["id"])
        for r in conn.execute(
            'SELECT id, "sampleId", epoch FROM eval_attempt WHERE "runId" = %s',
            (run_id,),
        )
    }
    headline = im.headline_scorer(log)
    found_eval = conn.execute('SELECT "displayName", slug FROM eval WHERE id = %s', (eval_id,)).fetchone()
    eval_name, slug = found_eval["displayName"], found_eval["slug"]
    by_model: dict[str, dict[str, Any]] = {}
    by_role: dict[str, dict[str, Any]] = {}
    fallbacks: Counter[tuple[str, str]] = Counter()
    defs = version.get("scores") or []
    # A headline scorer with no seed score def or pass rule has no direction, so its attempts get no pass or fail.
    undirected = bool(headline) and not im.score_def(defs, headline) and not any(d.get("pass") for d in defs)
    unmarked = Counter[str]()

    def rows() -> Iterator[tuple[dict[str, Any], tuple[str, dict[str, Any]], SampleKey | None]]:
        """Each sample's attempt, transcript and `eval_sample` key. Adds the sample's calls to the usage."""
        for ordinal, sample in enumerate(samples, start=1):
            a = im.attempt(
                sample, ordinal, headline, log.eval.model, defs, log.eval.task, version["metrics"]
            )
            if undirected and headline in a["scores"]:
                unmarked[headline] += 1
            a["id"] = old.get((a["sampleId"], a["epoch"])) or str(uuid7())
            a["runId"] = run_id
            a["display"] = im.display(sample, version["sampleTerms"])
            a["hazard"] = hazard(slug, sample)
            a["metrics"] = im.group_metrics(log.eval.task, sample.metadata)
            a["sampleMetadata"] = sample.metadata
            body = im.transcript(sample, a["id"], model_id, log.eval.model, log.eval.task)
            spec.Transcript.model_validate(body)
            a["bodyKey"] = body_key(prefix, a["id"], body)
            spec.EvalAttempt.model_validate(
                drop_none(
                    {**a, "sampleMetadata": None, "bodyKey": None, "body": {"key": a["bodyKey"], "bytes": 0}}
                )
            )
            for name, use in im.calls(
                sample, unlogged=not rescore, price=estimate_cost
            ).items():
                m = by_model.setdefault(
                    name,
                    {
                        "tokens": {"input": 0, "output": 0, "reasoning": 0},
                        "servedBy": set(),
                        "costUsd": 0.0,
                    },
                )
                for k, v in use["tokens"].items():
                    m["tokens"][k] += v
                m["servedBy"] |= use["servedBy"]
                m["costUsd"] += use["costUsd"]
            for role, use in im.role_calls(
                sample, log.eval.model, estimate_cost
            ).items():
                r = by_role.setdefault(role, {"tokens": {}, "costUsd": 0.0})
                for k, v in use["tokens"].items():
                    r["tokens"][k] = r["tokens"].get(k, 0) + v
                r["costUsd"] += use["costUsd"]
            fallbacks.update(fallback_calls(sample, slots, settings))
            yield a, (a["bodyKey"], body), sample_key(sample, log, splits)

    bucket.put_file(log_key, path, LOG_TYPE)
    status = {"success": "succeeded", "cancelled": "cancelled"}.get(
        log.status, "failed"
    )
    error = log.error.message if log.error else None
    total = log.eval.dataset.samples
    capability = capability_direction(conn, eval_id)

    with conn.transaction():
        if new:
            conn.execute(
                """INSERT INTO eval_run (id, "evalId", "evalVersionId", "modelId", origin, status, route, settings,
                     visibility, "startedAt", "updatedAt")
                   VALUES (%s, %s, %s, %s, 'import', 'importing', %s, %s, %s, now(), now())""",
                (
                    run_id,
                    eval_id,
                    version_id,
                    model_id,
                    jsonb(route),
                    jsonb(settings),
                    visibility,
                ),
            )
        conn.execute('DELETE FROM eval_result WHERE "evalRunId" = %s', (run_id,))
        conn.execute('DELETE FROM eval_attempt WHERE "runId" = %s', (run_id,))
        harness = drop_none({"tool": "inspect_ai", "version": (log.eval.packages or {}).get("inspect_ai")})
        base = run_settings(conn, run_id, task=log.eval.task, harness=harness)
        count = 0
        totals = dict.fromkeys(("input", "output", "reasoning"), 0)
        with conn.cursor() as cur:
            for chunk in itertools.batched(rows(), BATCH):
                attempts = [a for a, _, _ in chunk]
                sizes = bucket.put_many_json([b for _, b, _ in chunk])
                ids = save_samples(conn, version_id, [k for _, _, k in chunk if k])
                by_sample: dict[str, dict[str, Any]] = {}
                for (a, _, k), size in zip(chunk, sizes):
                    a["bodyBytes"] = size
                    a["evalSampleId"] = ids.get(k[:2]) if k else None
                    a["settings"] = attempt_settings(base, a.pop("sampleMetadata"))
                    if a["evalSampleId"]:
                        by_sample.setdefault(a["evalSampleId"], a["settings"])
                    for k in totals:
                        totals[k] += a["tokens"][k]
                count += len(attempts)
                cur.executemany(
                    """INSERT INTO eval_attempt (id, "runId", ordinal, "sampleId", "evalSampleId", epoch, status, passed,
                         input, target, choices, output, scores, metrics, error, "notScored", tokens, seconds, display,
                         hazard, "bodyKey", "bodyBytes", settings)
                       VALUES (%(id)s, %(runId)s, %(ordinal)s, %(sampleId)s, %(evalSampleId)s, %(epoch)s, %(status)s,
                         %(passed)s, %(input)s, %(target)s, %(choices)s, %(output)s, %(scores)s, %(metrics)s, %(error)s,
                         %(notScored)s, %(tokens)s, %(seconds)s, %(display)s, %(hazard)s, %(bodyKey)s, %(bodyBytes)s,
                         %(settings)s)""",
                    [
                        {
                            **a,
                            "target": jsonb(a["target"]),
                            "scores": jsonb(a["scores"]),
                            "tokens": jsonb(a["tokens"]),
                            "settings": jsonb(a["settings"]),
                        }
                        for a in attempts
                    ],
                )
                save_sample_settings(conn, run_id, by_sample)
            served = by_model.get(log.eval.model, {}).get("servedBy", set())
            usage = model_usage(by_model, log.eval.model, rescore)
            cost = sum(m.get("costUsd", 0) for m in usage.values())
            used = [
                {"slot": sid, "model": m, "calls": n}
                for (sid, m), n in sorted(fallbacks.items())
            ]
            rsettings = result_settings(route, settings, total, slots, used)
            provenance.update(
                drop_none(
                    {
                        "tool": "inspect_ai",
                        "toolVersion": (log.eval.packages or {}).get("inspect_ai"),
                        "packages": log.eval.packages or None,
                        "task": log.eval.task,
                        "taskArgs": log.eval.task_args or None,
                        "logModel": log.eval.model,
                        "servedBy": sorted(served) or None,
                        "startedAt": log.stats.started_at or None,
                        "finishedAt": log.stats.completed_at or None,
                        "tokens": totals,
                        "costUsd": round(cost, 6) if cost else None,
                        "byModel": usage or None,
                        "byRole": role_usage(by_role, rescore, scoring_roles(slots))
                        or None,
                        "fallbacks": used or None,
                        "note": (log.eval.metadata or {}).get("note") or None,
                    }
                )
            )
            cur.executemany(
                """INSERT INTO eval_result (id, origin, "evalId", "evalVersionId", "rawEvalName", "modelId", metric,
                     value, unit, stderr, n, "safetyDirection", "capabilityDirection", settings, "evalRunId",
                     reviewed, "updatedAt")
                   VALUES (%s, 'measured', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, false, now())""",
                [
                    (
                        str(uuid7()),
                        eval_id,
                        version_id,
                        eval_name,
                        model_id,
                        r["metric"],
                        r["value"],
                        r["unit"],
                        r["stderr"],
                        r["n"],
                        r["safetyDirection"],
                        None if im.is_stderr(r["metric"]) else capability,
                        jsonb(rsettings),
                        run_id,
                    )
                    for r in im.results(log, version["metrics"])
                ],
            )
        done = conn.execute(
            """UPDATE eval_run SET status = %s, error = %s, provenance = %s, "logKey" = %s, "logBytes" = %s,
                 "logSha256" = %s, "sampleCount" = %s, "attemptCount" = %s, "finishedAt" = now(),
                 "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now()
               WHERE id = %s AND status <> 'cancelled'""",
            (
                status,
                error,
                jsonb(provenance),
                log_key,
                path.stat().st_size,
                digest,
                count,
                count,
                run_id,
            ),
        )
        if done.rowcount == 0:
            raise RunCancelled(f"Run {run_id} is cancelled; the import stops.")
    if new:
        bucket.put_json(claim_key(digest), {"runId": run_id})
    if refresh_stats(conn, version_id) is None:
        print("Note: no refresh_sample_stats in the database; the samples' fail counts stay.", file=sys.stderr)
    print(
        f"Run {run_id}: {status}, {count} attempts, served by {sorted(served) or 'unknown'}, ${cost:.4f}.",
        flush=True,
    )
    for name, n in unmarked.items():
        print(
            f"Warning: {n} attempts have no pass or fail: no seed score has the key or attemptName {name!r}.",
            file=sys.stderr,
            flush=True,
        )
    return run_id


FINISHED = ("succeeded", "failed", "cancelled")


def alive(conn: psycopg.Connection) -> psycopg.Connection:
    """The connection, or a new one when the server closed it (Neon closes idle ones)."""
    try:
        conn.execute("SELECT 1")
        return conn
    except psycopg.OperationalError:
        return connect()


def transcript_changes(bucket: Bucket, bodies: list[tuple[str, str, dict[str, Any]]]) -> Counter[str]:
    """How each new transcript differs from the stored one: `same`, `rolePrompts` (only the role
    prompts are new or changed), `other` or `missing`."""

    def strip(t: dict[str, Any]) -> dict[str, Any]:
        ext = t.get("extensions") or {}
        inspect = {k: v for k, v in (ext.get("inspect") or {}).items() if k != "rolePrompts"}
        return {**t, "extensions": {**ext, "inspect": inspect}}

    def change(item: tuple[str, str, dict[str, Any]]) -> str:
        _, key, body = item
        try:
            old = json.loads(bucket.get(key))
        except bucket.s3.exceptions.NoSuchKey:
            return "missing"
        return "same" if old == body else "rolePrompts" if strip(old) == strip(body) else "other"

    with ThreadPoolExecutor(16) as pool:
        return Counter(pool.map(change, bodies))


def retranscribe(
    conn: psycopg.Connection,
    bucket: Bucket,
    slug: str,
    run_id: str | None = None,
    rebuild: bool = True,
    recheck: bool = True,
    dry_run: bool = False,
) -> int:
    """Writes the transcripts and outputs of an eval's finished runs again from their logs. With
    `recheck`, the flagger checks them again. With `rebuild`, the cards build again. A run that is
    not finished is skipped: its import writes them. `dry_run`: prints how the transcripts differ
    from the stored ones and writes nothing. Returns the attempt count."""
    runs = conn.execute(
        """SELECT r.id, r."logKey", r."modelId" FROM eval_run r JOIN eval e ON e.id = r."evalId"
           WHERE e.slug = %s AND r."logKey" IS NOT NULL AND r.status = ANY(%s)
             AND (%s::uuid IS NULL OR r.id = %s::uuid)
           ORDER BY r."createdAt" """,
        (slug, list(FINISHED), run_id, run_id),
    ).fetchall()
    total = 0
    for run in runs:
        conn = alive(conn)
        attempts = {
            (r["sampleId"], r["epoch"]): r
            for r in conn.execute(
                'SELECT id, "sampleId", epoch, "bodyKey" FROM eval_attempt WHERE "runId" = %s',
                (run["id"],),
            )
        }
        with tempfile.NamedTemporaryFile(suffix=".eval") as f:
            f.write(bucket.get(run["logKey"]))
            f.flush()
            path = Path(f.name)
            log = (
                read_header(path) if zipfile.is_zipfile(path) else read_eval_log(f.name)
            )
            bodies = []
            outputs: list[str | None] = []
            for sample in log_samples(path, log):
                a = attempts.get((str(sample.id), sample.epoch))
                if not a or not a["bodyKey"]:
                    continue
                body = im.transcript(
                    sample, str(a["id"]), str(run["modelId"]), log.eval.model, log.eval.task
                )
                spec.Transcript.model_validate(body)
                bodies.append((str(a["id"]), a["bodyKey"], body))
                outputs.append(im.no_nul(im.short(im.final_text(sample, log.eval.model))))
        if dry_run:
            print(f"Run {run['id']}: {dict(transcript_changes(bucket, bodies))}", flush=True)
            total += len(bodies)
            continue
        keys = [body_key(f"runs/{run['id']}/", i, b) for i, _, b in bodies]
        sizes = bucket.put_many_json([(k, b) for k, (_, _, b) in zip(keys, bodies)])
        # Reading a large log can take longer than Neon keeps an idle connection.
        conn = alive(conn)
        with conn.cursor() as cur:
            cur.executemany(
                'UPDATE eval_attempt SET "bodyKey" = %s, "bodyBytes" = %s, output = %s WHERE id = %s',
                [
                    (key, size, out, i)
                    for (i, _, _), key, size, out in zip(bodies, keys, sizes, outputs)
                ],
            )
            # A newer run shows on /admin/sync as changed, so production gets the new keys.
            cur.execute('UPDATE eval_run SET "updatedAt" = now() WHERE id = %s', (run["id"],))
            if recheck:
                cur.execute(
                    'DELETE FROM openaudit_flag_check WHERE "attemptId" = ANY(%s::uuid[])',
                    ([i for i, _, _ in bodies],),
                )
            if rebuild:
                cur.execute(
                    """UPDATE openaudit_card SET "rebuildAt" = now(), "updatedAt" = now()
                       WHERE "modelId" = %s""",
                    (run["modelId"],),
                )
        conn.commit()
        total += len(bodies)
        print(f"Run {run['id']}: {len(bodies)} transcripts written again.", flush=True)
    return total


def apply_terms(conn: psycopg.Connection, bucket: Bucket, slug: str) -> int:
    """Sets each attempt's subset rule again from its run's log. Returns the changed count."""
    runs = conn.execute(
        """SELECT r.id, r."logKey", v."sampleTerms" FROM eval_run r
           JOIN eval_version v ON v.id = r."evalVersionId" JOIN eval e ON e.id = r."evalId"
           WHERE e.slug = %s AND r."logKey" IS NOT NULL""",
        (slug,),
    ).fetchall()
    changed = 0
    for run in runs:
        with tempfile.NamedTemporaryFile(suffix=".eval") as f:
            f.write(bucket.get(run["logKey"]))
            f.flush()
            log = read_eval_log(f.name)
        rows = [
            (im.display(s, run["sampleTerms"]), run["id"], str(s.id), s.epoch)
            for s in log.samples or []
        ]
        with conn.cursor() as cur:
            cur.executemany(
                """UPDATE eval_attempt SET display = %s
                   WHERE "runId" = %s AND "sampleId" = %s AND epoch = %s
                     AND display IS DISTINCT FROM %s""",
                [(*r, r[0]) for r in rows],
            )
            changed += cur.rowcount
    conn.commit()
    return changed


def apply_hazards(conn: psycopg.Connection, bucket: Bucket, slug: str, *, dry_run: bool = False) -> Counter[tuple[str | None, str | None]]:
    """Sets each attempt's hazard again from its run's log, and marks a changed run as updated so the
    prod sync copies it. Returns the changes, (old, new): count."""
    runs = conn.execute(
        """SELECT r.id, r."logKey" FROM eval_run r JOIN eval e ON e.id = r."evalId"
           WHERE e.slug = %s AND r."logKey" IS NOT NULL""",
        (slug,),
    ).fetchall()
    changes: Counter[tuple[str | None, str | None]] = Counter()
    for run in runs:
        old = {
            (r["sampleId"], r["epoch"]): r["hazard"]
            for r in conn.execute('SELECT "sampleId", epoch, hazard FROM eval_attempt WHERE "runId" = %s', (run["id"],))
        }
        with tempfile.NamedTemporaryFile(suffix=".eval") as f:
            f.write(bucket.get(run["logKey"]))
            f.flush()
            log = read_eval_log(f.name)
        rows = [
            (new, run["id"], str(s.id), s.epoch)
            for s in log.samples or []
            if (key := (str(s.id), s.epoch)) in old and (new := hazard(slug, s)) != old[key]
        ]
        changes.update((old[(r[2], r[3])], r[0]) for r in rows)
        if rows and not dry_run:
            with conn.cursor() as cur:
                cur.executemany(
                    'UPDATE eval_attempt SET hazard = %s WHERE "runId" = %s AND "sampleId" = %s AND epoch = %s', rows
                )
                cur.execute('UPDATE eval_run SET "updatedAt" = now() WHERE id = %s', (run["id"],))
            conn.commit()
    return changes
