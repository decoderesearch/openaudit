"""Runs queued evals. A run is cut into shards of samples: runners claim shards and run them
with Inspect, and the runner that ends the last shard merges the shard logs and imports the
merged log. A re-score runs in one piece."""

import _thread
import contextlib
import json
import os
import random
import socket
import threading
import time
import traceback
import zipfile
from collections.abc import Callable, Iterator
from enum import Enum
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from typing import Any, Self

import sentry_sdk
from inspect_ai import eval as inspect_eval
from inspect_ai import score
from inspect_ai._eval.score import (
    metrics_from_log_header,
    reducers_from_log_header,
    resolve_scorers_info,
)
from inspect_ai._eval.task.results import eval_results
from inspect_ai._util.entrypoints import ensure_entry_points
from inspect_ai._util.json import to_json_safe
from inspect_ai._util.registry import registry_create
from inspect_ai._util.zipfile import zipfile_compress_kwargs
from inspect_ai.hooks import Hooks, SampleEnd, hooks
from inspect_ai.log import EvalLog, read_eval_log, write_eval_log
from inspect_ai.log._recorders.eval import (
    HEADER_JSON,
    JOURNAL_DIR,
    REDUCTIONS_JSON,
    START_JSON,
    SUMMARIES_JSON,
    LogStart,
)
from inspect_ai.model import GenerateConfig, Model, ModelOutput, ModelUsage, get_model
from inspect_ai.model._model import RetryDecision
from inspect_ai.model._providers.openrouter import OpenRouterAPI
from inspect_ai.scorer import SampleScore, Score
from uuid6 import uuid7

from . import (
    __version__,
    mc_answer,  # noqa: F401 - reads "ANSWER: $D" in multiple-choice tasks.
)
from .auditor import auditor_problem
from .blocks import note, reply_blocked, summarize
from .fallback import FallbackModel
from .hf_mirror import BucketReader, mirror
from .ingest import LOG_TYPE, SAMPLES, RunCancelled, import_log, read_header
from .ladders import tier_routes
from .notify import notify_web
from .reload import CodeWatch, restart, restart_if_changed
from .store import Bucket, Db, jsonb, open_bucket

LEASE = "5 minutes"
BEAT_SECONDS = 10
MAX_TRIES = 2
SHARD_SIZE = 50
CONNECTIONS = 16
# Seed of the random samples that a run with a limit does. The same in each process.
LIMIT_SEED = 0
# Samples that runs of a task never use, as their dataset's terms keep them out of public text.
SKIP_SAMPLES: dict[str, Callable[[Any], bool]] = {
    "inspect_evals/abstention_bench": lambda s: (s.metadata or {}).get("dataset_name")
    == "GPQA",
}
# Inspect retries HTTP 429 and 5xx. This runs a sample again after other errors, for example
# an OpenRouter error in a 200 body (503, no provider) or an error in a scorer.
SAMPLE_RETRIES = 3
# Limits for each model call, judges included. Without them, Inspect retries a 5xx with no
# end, and one sample can stop a shard for hours.
MODEL_RETRIES = 8
MODEL_TIMEOUT = 1800
GROUPED = "inspect_ai/grouped"
# In one-run mode: the longest wait for a cap to have room, in seconds.
CAP_WAIT = 600
ROOM_WAIT = "wait for room in their caps or in memory"
# A run with more errored samples than this part fails: its results would rest on few samples.
MAX_ERRORED = 0.75
# A run with more samples with no reply from the target than this part fails.
MAX_EMPTY = 0.5
# Token counts in a sample's `model_usage`. A sample with none from the target got no reply.
USAGE_TOKENS = (
    "input_tokens",
    "output_tokens",
    "input_tokens_cache_read",
    "input_tokens_cache_write",
)
# Memory in GB that a shard needs, when its eval version gives no `memoryGb`. A runner claims
# a shard only when the machine has that much free above a reserve.
SHARD_MEMORY_GB = 1.0
TASK_MEMORY_GB = {
    "openaudit_runner/do_not_answer": 3.5,  # Two Longformer models.
    "inspect_evals/abstention_bench": 2.0,
}
# A shard that started this recently may not use all its memory yet, so the claim counts it.
MEMORY_WARMUP = "3 minutes"
CACHE = (
    Path(os.environ.get("OPENAUDIT_CACHE") or Path.home() / ".cache" / "openaudit")
    / "runs"
)

_openrouter_should_retry = OpenRouterAPI.should_retry


def openrouter_should_retry(self: OpenRouterAPI, ex: BaseException) -> bool | RetryDecision:
    """No retry for a reply that the provider's filter blocked. The sample retries still apply."""
    if reply_blocked(str(ex)):
        return RetryDecision.no()
    return _openrouter_should_retry(self, ex)


OpenRouterAPI.should_retry = openrouter_should_retry  # type: ignore[method-assign]

CLAIM = f"""
UPDATE eval_run SET status = 'running', "leaseOwner" = %(owner)s, "leaseExpiresAt" = now() + interval '{LEASE}',
  tries = tries + 1, "startedAt" = now(), "attemptCount" = 0, error = NULL, "updatedAt" = now()
WHERE id = (
  SELECT id FROM eval_run
  WHERE origin = 'rescore' AND tries < {MAX_TRIES} AND (%(run)s::uuid IS NULL OR id = %(run)s::uuid)
    AND (status = 'queued' OR (status IN ('running', 'importing') AND "leaseExpiresAt" < now()))
  ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING *"""

# A run with no shards. The lease keeps other runners from planning it too.
PLAN = f"""
UPDATE eval_run SET status = 'running', "leaseOwner" = %(owner)s, "leaseExpiresAt" = now() + interval '{LEASE}',
  tries = tries + 1, "startedAt" = now(), "attemptCount" = 0, error = NULL, "updatedAt" = now()
WHERE id = (
  SELECT r.id FROM eval_run r
  WHERE r.origin = 'run' AND r.tries < {MAX_TRIES} AND (%(run)s::uuid IS NULL OR r.id = %(run)s::uuid)
    AND (r.status = 'queued' OR (r.status IN ('running', 'importing') AND r."leaseExpiresAt" < now()))
    AND NOT EXISTS (SELECT 1 FROM eval_run_shard s WHERE s."runId" = r.id)
  ORDER BY r."createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING *"""

# Connections of running shards with a live lease, by cap key.
LIVE = """(SELECT coalesce(sum(u.connections), 0) FROM eval_run_shard u
  WHERE u.status = 'running' AND u."leaseExpiresAt" > now() AND {where})"""
LIVE_OPENROUTER = LIVE.format(where="""u."capKey" LIKE 'openrouter%%'""")
LIVE_SAME_KEY = LIVE.format(where='u."capKey" = c."capKey"')
MEMORY = """coalesce(({v}.runner->>'memoryGb')::float,
  (%(task_memory)s::jsonb->>({v}.runner->>'task'))::float, %(shard_memory)s)"""
WARMING = f"""(SELECT coalesce(sum({MEMORY.format(v="wv")}), 0) FROM eval_run_shard w
  JOIN eval_run wr ON wr.id = w."runId" JOIN eval_version wv ON wv.id = wr."evalVersionId"
  WHERE w.status = 'running' AND w."leaseOwner" LIKE %(host)s
    AND w."startedAt" > now() - interval '{MEMORY_WARMUP}')"""

# Run after CLAIM_LOCK in the same transaction, so that two runners do not see the same free
# room in a cap.
CLAIM_SHARD = f"""
UPDATE eval_run_shard SET status = 'running', "leaseOwner" = %(owner)s,
  "leaseExpiresAt" = now() + interval '{LEASE}', tries = tries + 1, "startedAt" = now(), "attemptCount" = 0,
  error = NULL, "updatedAt" = now()
WHERE id = (
  SELECT c.id FROM eval_run_shard c JOIN eval_run r ON r.id = c."runId"
    JOIN eval_version v ON v.id = r."evalVersionId"
  WHERE r.status = 'running' AND c.tries < {MAX_TRIES} AND (%(run)s::uuid IS NULL OR c."runId" = %(run)s::uuid)
    AND (c.status = 'queued' OR (c.status = 'running' AND c."leaseExpiresAt" < now()))
    AND (%(room)s::float IS NULL OR {MEMORY.format(v="v")} + {WARMING} <= %(room)s::float)
    AND (c."capKey" NOT LIKE 'openrouter%%' OR c.connections + {LIVE_OPENROUTER}
      <= coalesce((SELECT "maxConnections" FROM runner_cap WHERE key = 'openrouter'), 2147483647))
    AND c.connections + {LIVE_SAME_KEY}
      <= coalesce((SELECT k."maxConnections" FROM runner_cap k WHERE k.key = c."capKey"), 2147483647)
  ORDER BY r."createdAt", c.ordinal
  FOR UPDATE OF c SKIP LOCKED LIMIT 1
)
RETURNING *"""
CLAIM_LOCK = "SELECT pg_advisory_xact_lock(hashtext('openaudit:claim_shard'))"

# A sharded run whose shards all succeeded and that no runner merges now.
FINISH = f"""
UPDATE eval_run SET status = 'importing', "leaseOwner" = %(owner)s,
  "leaseExpiresAt" = now() + interval '{LEASE}', "updatedAt" = now()
WHERE id = (
  SELECT r.id FROM eval_run r
  WHERE r.origin = 'run' AND r.status IN ('running', 'importing')
    AND (r."leaseExpiresAt" IS NULL OR r."leaseExpiresAt" < now()) AND (%(run)s::uuid IS NULL OR r.id = %(run)s::uuid)
    AND EXISTS (SELECT 1 FROM eval_run_shard s WHERE s."runId" = r.id)
    AND NOT EXISTS (SELECT 1 FROM eval_run_shard s WHERE s."runId" = r.id AND s.status <> 'succeeded')
  ORDER BY r."createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
)
RETURNING *"""

# Shards whose runner stopped on the last try.
SWEEP = f"""
UPDATE eval_run_shard SET status = 'failed', error = coalesce(error, 'The runner stopped.'), "finishedAt" = now(),
  "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now()
WHERE status = 'running' AND "leaseExpiresAt" < now() AND tries >= {MAX_TRIES}
RETURNING *"""

RUN_COUNT = """
UPDATE eval_run r SET "attemptCount" = (SELECT coalesce(sum(s."attemptCount"), 0) FROM eval_run_shard s
    WHERE s."runId" = r.id AND s.status IN ('running', 'succeeded')), "updatedAt" = now()
WHERE id = %s AND status = 'running'
RETURNING status"""


class Progress:
    """Samples done in the current eval. Inspect's hooks write it; the heartbeat reads it."""

    planned: int | None = None
    done = 0


@hooks(
    name="openaudit_progress", description="Counts finished samples for the run page."
)
class ProgressHook(Hooks):
    async def on_sample_end(self, data: SampleEnd) -> None:
        Progress.done += 1


class Watch:
    """A heartbeat thread with its own connection. It calls `beat` every BEAT_SECONDS. When
    `beat` gives False and `interrupt` is set, it stops the eval in the main thread: Inspect
    then returns no log, or a KeyboardInterrupt comes, which the `with` block holds."""

    def __init__(self, beat: Callable[[Db], bool], interrupt: bool = False) -> None:
        self.beat, self.interrupt = beat, interrupt
        self.stopped = False
        self.done = threading.Event()
        self.lock = threading.Lock()
        self.thread = threading.Thread(target=self.loop, daemon=True)

    def loop(self) -> None:
        with Db() as db:
            while not self.done.wait(BEAT_SECONDS):
                try:
                    go_on = self.beat(db)
                except Exception:  # noqa: BLE001 - a failed beat must not stop the run.
                    traceback.print_exc()
                    continue
                if go_on or not self.interrupt:
                    continue
                with self.lock:
                    if not self.done.is_set():
                        self.stopped = True
                        _thread.interrupt_main()
                return

    def __enter__(self) -> Self:
        self.thread.start()
        return self

    def __exit__(self, kind: type[BaseException] | None, *exc: object) -> bool:
        with self.lock:
            self.done.set()
        try:
            while self.thread.is_alive():
                self.thread.join(1)
        except KeyboardInterrupt:
            if not self.stopped:
                raise
        return kind is KeyboardInterrupt and self.stopped


_reader: Any = None


def r2_reader() -> Any:
    """The R2 reader for the HF mirror: the signed bucket in a container, else R2 keys."""
    global _reader
    if _reader is None:
        bucket = open_bucket()
        _reader = bucket if hasattr(bucket, "get_range") else BucketReader(bucket)
    return _reader


@contextlib.contextmanager
def dataset_context(
    db: Db, run: dict[str, Any], version: dict[str, Any]
) -> Iterator[None]:
    """The context in which the task loads its dataset. All task and eval calls run in it.
    Hugging Face requests go to our R2 copy at the pinned commits. Others go to the Hub."""
    with mirror(r2_reader(), fresh_cache=True) as hf:
        yield
    dataset = version.get("dataset") or {}
    pinned = [
        (s["hfRepo"], s["revision"])
        for s in [dataset, *(dataset.get("sources") or [])]
        if s.get("hfRepo") and s.get("revision")
    ]
    served = {(repo, sha) for _, repo, sha in hf.served}
    if missing := [f"{r}@{s[:8]}" for r, s in pinned if (r, s) not in served]:
        print(f"Run {run['id']}: not from R2: {', '.join(missing)}.", flush=True)
    if hf.misses:
        paths = sorted({m["path"].split("?")[0] for m in hf.misses})
        print(
            f"Run {run['id']}: {len(hf.misses)} Hub requests not in R2: {', '.join(paths[:5])}",
            flush=True,
        )


def notify(run_id: str) -> None:
    """Asks the web app to send the run's emails. Best effort: an error does not stop the runner."""
    notify_web({"runId": run_id}, f"Run {run_id}")


def model_call(
    route: dict[str, Any], settings: dict[str, Any]
) -> tuple[str, dict[str, Any]]:
    """The Inspect model name and model args for a route."""
    args: dict[str, Any] = {}
    if route["kind"] == "openrouter":
        provider: dict[str, Any] = {
            "allow_fallbacks": route.get("allowFallbacks", False)
        }
        if route.get("providers"):
            provider["order"] = route["providers"]
        if route.get("quantization") not in (None, "unknown"):
            provider["quantizations"] = [route["quantization"]]
        args["provider"] = provider
        name = f"openrouter/{route['model']}"
    elif route["kind"] == "direct":
        name = route["model"]
    else:
        raise RuntimeError(
            f"This runner has no support for route kind {route['kind']}."
        )
    args.update(thinking(settings, route["kind"])[0])
    return name, args


EFFORTS = ("minimal", "low", "medium", "high", "xhigh")


def thinking(
    settings: dict[str, Any], kind: str = "openrouter"
) -> tuple[dict[str, Any], dict[str, Any]]:
    """The run's thinking effort as Inspect model args and generate config for the target.
    Inspect sends `max` to OpenRouter as `xhigh`, so `max` goes in `extra_body`.
    A direct route is a vLLM server: only on and off, through the chat template."""
    effort = settings.get("reasoning")
    if effort is None:
        return {}, {}
    if kind == "direct":
        if effort not in ("none", "off", "on"):
            raise RuntimeError(
                f"A direct route has no support for thinking effort {effort!r}."
            )
        on = effort == "on"
        return {}, {"extra_body": {"chat_template_kwargs": {"enable_thinking": on}}}
    if effort in ("none", "off"):
        return {"reasoning_enabled": False}, {}
    if effort == "on":
        return {"reasoning_enabled": True}, {}
    if effort == "max":
        return {}, {"extra_body": {"reasoning": {"effort": "max"}}}
    if effort in EFFORTS:
        return {}, {"reasoning_effort": effort}
    raise RuntimeError(f"This runner has no support for thinking effort {effort!r}.")


def slot_routes(
    slots: list[dict[str, Any]], settings: dict[str, Any], target: str
) -> dict[str, dict[str, Any]]:
    """The run's route for each slot. A slot that the settings leave out gets its tier's model
    for the target, else the slot's default, through OpenRouter."""
    chosen = settings.get("models") or {}
    tiered = tier_routes([s for s in slots if s["id"] not in chosen], target)
    return {
        s["id"]: chosen.get(s["id"])
        or tiered.get(s["id"])
        or {"kind": "openrouter", "model": s["default"], "allowFallbacks": True}
        for s in slots
    }


def loose_tools(runner: dict[str, Any]) -> dict[str, Any]:
    """Model args for an eval with an auditor (Petri): tools not in strict mode. Its tools have
    optional parameters, and some providers (Azure) refuse those in strict mode."""
    if any(s["role"] == "auditor" for s in runner.get("models") or []):
        return {"strict_tools": False}
    return {}


FALLBACK_RETRIES = 5


def slot_model(route: dict[str, Any], runner: dict[str, Any]) -> Model:
    """The model for a slot's route, with its fallbacks. Not memoized: each slot sets its own
    role on its model. A model with a fallback stops retrying sooner (a re-score has no
    retry limit), so that the next model takes the call."""
    names = [route["model"], *route.get("fallbacks", [])]
    models = [
        get_model(
            name,
            memoize=False,
            **({"config": GenerateConfig(max_retries=FALLBACK_RETRIES)} if i < len(names) - 1 else {}),
            **args,
            **loose_tools(runner),
        )
        for i, (name, args) in enumerate(model_call({**route, "model": m}, {}) for m in names)
    ]
    return FallbackModel(models) if len(models) > 1 else models[0]


def slot_inputs(
    runner: dict[str, Any], settings: dict[str, Any], target: str
) -> tuple[dict[str, Any], dict[str, Model]]:
    """The task args and Inspect model roles that give the task each slot's model. Each model's
    role is the slot's Inspect role, else the slot id, so the log shows the slot of each call."""
    task_args: dict[str, Any] = {}
    roles: dict[str, Model] = {}
    slots = runner.get("models") or []
    routes = slot_routes(slots, settings, target)
    for slot in slots:
        model = slot_model(routes[slot["id"]], runner)
        model._set_role(slot.get("inspectRole") or slot["id"])
        if slot.get("inspectRole"):
            roles[slot["inspectRole"]] = model
        elif slot.get("index") is None:
            task_args[slot["taskArg"]] = model
        else:
            items = task_args.setdefault(slot["taskArg"], [])
            items.extend([None] * (slot["index"] + 1 - len(items)))
            items[slot["index"]] = model
    return task_args, roles


def has_gpu() -> bool:
    try:
        import torch
    except ImportError:
        return False
    return torch.cuda.is_available()


def check_runner(runner: dict[str, Any] | None) -> str:
    """The task to run. Fails when this runner cannot run it as the eval version states."""
    if not runner or runner.get("kind") != "inspect" or not runner.get("task"):
        raise RuntimeError("The eval version has no Inspect task.")
    if runner.get("sandbox"):
        raise RuntimeError("This runner cannot run tasks that need a sandbox.")
    if runner.get("gpu") and not has_gpu():
        raise RuntimeError("The eval needs a GPU, and this runner has no CUDA GPU.")
    slots = runner.get("models") or []
    for slot in slots:
        if bool(slot.get("taskArg")) == bool(slot.get("inspectRole")):
            raise RuntimeError(
                f"Model slot {slot['id']} must give taskArg or inspectRole."
            )
    filled = {"target"} | {s["role"] for s in slots}
    if missing := set(runner.get("roles", ["target"])) - filled:
        raise RuntimeError(f"No model slot fills the roles {sorted(missing)}.")
    for pin in [runner.get("package"), *runner.get("dependencies", [])]:
        if not pin:
            continue
        name, _, want = pin.partition("==")
        name = name.split("[")[0].strip()
        try:
            have = version(name)
        except PackageNotFoundError:
            raise RuntimeError(f"{name} is not installed.") from None
        if want and have != want:
            raise RuntimeError(f"The eval pins {pin}, but {name} {have} is installed.")
    return runner["task"]


class Inputs:
    """What an Inspect call for a run needs."""

    def __init__(self, runner: dict[str, Any], run: dict[str, Any]) -> None:
        self.task = check_runner(runner)
        self.settings: dict[str, Any] = run["settings"]
        self.model, self.model_args = model_call(run["route"], self.settings)
        self.generate = thinking(self.settings, run["route"]["kind"])[1]
        target = run["route"]["model"]
        slots = runner.get("models") or []
        routes = slot_routes(slots, self.settings, target)
        for slot in slots:
            if slot["role"] == "auditor" and (
                problem := auditor_problem(target, routes[slot["id"]]["model"])
            ):
                raise RuntimeError(problem)
        if run["route"]["kind"] == "openrouter":
            self.model_args.update(loose_tools(runner))
        slot_args, self.roles = slot_inputs(runner, self.settings, target)
        if runner.get("targetRole"):
            self.roles[runner["targetRole"]] = get_model(
                self.model, config=role_config(self.settings, self.generate), **self.model_args
            )
        self.task_args = {**(self.settings.get("taskArgs") or {}), **slot_args}


def role_config(settings: dict[str, Any], generate: dict[str, Any]) -> GenerateConfig:
    """Generate config for the target in a role. The eval's generate settings reach only the
    main model, not a role model."""
    return GenerateConfig(
        max_retries=MODEL_RETRIES,
        timeout=MODEL_TIMEOUT,
        temperature=settings.get("temperature"),
        max_tokens=settings.get("maxTokens"),
        **generate,
    )


def version_of(db: Db, run: dict[str, Any]) -> dict[str, Any]:
    return db.execute(
        "SELECT id, runner, dataset FROM eval_version WHERE id = %s",
        (run["evalVersionId"],),
    ).fetchone()


def fail_run(
    db: Db, run_id: str, error: str, blocks: list[dict[str, Any]] | None = None
) -> None:
    """Fails the run and cancels its queued shards. A finished or cancelled run stays as it is.
    The provider blocks that caused it go in the provenance; with no `blocks`, the ones that
    `error` states (with no sample count)."""
    if blocks is None:
        blocks = [b | {"samples": 0} for b in summarize([error])]

    def fail(conn: Any) -> bool:
        with conn.transaction():
            row = conn.execute(
                """UPDATE eval_run SET status = 'failed', error = %s, "finishedAt" = now(), "leaseOwner" = NULL,
                     "leaseExpiresAt" = NULL, provenance = coalesce(provenance, '{}'::jsonb) || %s,
                     "updatedAt" = now()
                   WHERE id = %s AND status IN ('queued', 'running', 'importing') RETURNING id""",
                (error[:2000], jsonb({"blocks": blocks} if blocks else {}), run_id),
            ).fetchone()
            conn.execute(
                """UPDATE eval_run_shard SET status = 'cancelled', "updatedAt" = now()
                   WHERE "runId" = %s AND status = 'queued'""",
                (run_id,),
            )
        return row is not None

    if db.call(fail):
        print(f"Run {run_id}: failed. {error}", flush=True)
        notify(run_id)


def error_text(e: BaseException) -> str:
    return f"{type(e).__name__}: {e}"[:2000]


def plan(db: Db, run: dict[str, Any], owner: str) -> None:
    """Cuts the run into shards of `shardSize` samples, in dataset order."""
    run_id = str(run["id"])
    version = version_of(db, run)
    inputs = Inputs(version["runner"], run)
    settings = inputs.settings
    ensure_entry_points()
    Progress.planned, Progress.done = None, 0
    limit = settings.get("limit") if isinstance(settings.get("limit"), int) else None
    with Watch(lambda d: run_beat(d, run_id, owner)), dataset_context(db, run, version):
        dataset = seeded_task(inputs.task, inputs.task_args).dataset
        ids = run_ids(dataset, limit, SKIP_SAMPLES.get(inputs.task))
    total = len(ids) if ids is not None else min(len(dataset), limit or len(dataset))
    if total == 0:
        raise RuntimeError("The task's dataset has no samples.")
    route = run["route"]
    if settings.get("capKey"):
        cap_key = settings["capKey"]
    elif route["kind"] != "openrouter":
        cap_key = f"{route['kind']}:{route['model'].split('/')[0]}"
    elif route.get("providers"):
        cap_key = f"openrouter:{route['providers'][0]}"
    else:
        cap_key = "openrouter"
    caps = {
        r["key"]: r["maxConnections"]
        for r in db.execute(
            "SELECT key, \"maxConnections\" FROM runner_cap WHERE key IN ('openrouter', %s)",
            (cap_key,),
        )
    }
    if not cap_key.startswith("openrouter"):
        caps.pop("openrouter", None)
    connections = min([settings.get("maxConnections") or CONNECTIONS, *caps.values()])
    size = settings.get("shardSize") or SHARD_SIZE
    epochs = settings.get("epochs") or 1
    shards = [
        (
            str(uuid7()),
            run_id,
            i + 1,
            start,
            min(start + size, total),
            connections,
            cap_key,
        )
        for i, start in enumerate(range(0, total, size))
    ]

    def save(conn: Any) -> bool:
        with conn.transaction():
            if (
                conn.execute(
                    """UPDATE eval_run SET "sampleCount" = %s, provenance = %s, "leaseOwner" = NULL,
                     "leaseExpiresAt" = NULL, "updatedAt" = now()
                   WHERE id = %s AND "leaseOwner" = %s AND status = 'running'""",
                    (
                        total * epochs,
                        jsonb(
                            {"host": socket.gethostname(), "runnerVersion": __version__}
                        ),
                        run_id,
                        owner,
                    ),
                ).rowcount
                == 0
            ):
                return False
            with conn.cursor() as cur:
                cur.executemany(
                    """INSERT INTO eval_run_shard (id, "runId", ordinal, "sampleStart", "sampleEnd", status,
                         connections, "capKey", "updatedAt")
                       VALUES (%s, %s, %s, %s, %s, 'queued', %s, %s, now())""",
                    shards,
                )
        return True

    if db.call(save):
        print(
            f"Run {run_id}: {total} samples x {epochs} epochs in {len(shards)} shards of {size}, "
            f"{connections} connections each, cap {cap_key}.",
            flush=True,
        )


def plan_failed(db: Db, run: dict[str, Any], e: Exception) -> None:
    if run["tries"] < MAX_TRIES:
        db.execute(
            """UPDATE eval_run SET status = 'queued', error = %s, "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
                 "updatedAt" = now()
               WHERE id = %s AND status = 'running'""",
            (error_text(e), str(run["id"])),
        )
    else:
        fail_run(db, str(run["id"]), error_text(e))


def memory_room() -> float | None:
    """The GB that a new shard may use on this machine: free memory (in a container, below its
    limit) less a reserve. None: not known."""
    try:
        info = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
        total = int(info["MemTotal"].split()[0]) / 2**20
        free = int(info["MemAvailable"].split()[0]) / 2**20
    except (OSError, KeyError, ValueError):
        return None
    with contextlib.suppress(OSError, ValueError):
        limit = Path("/sys/fs/cgroup/memory.max").read_text().strip()
        if limit != "max":
            used = int(Path("/sys/fs/cgroup/memory.current").read_text())
            total, free = min(total, int(limit) / 2**30), min(free, (int(limit) - used) / 2**30)
    reserve = os.environ.get("OPENAUDIT_MEMORY_RESERVE_GB")
    return free - (float(reserve) if reserve else total * 0.15 + 1)


def host_key(boot_id: Path = Path("/proc/sys/kernel/random/boot_id")) -> str:
    """The machine part of a shard owner. The claim counts the memory of new shards with the
    same part. Containers can have the same host name, so it also has the boot id."""
    try:
        boot = boot_id.read_text().strip()[:8]
    except OSError:
        return socket.gethostname()
    return f"{socket.gethostname()}-{boot}"


def claim_shard(db: Db, owner: str, run_id: str | None) -> dict[str, Any] | None:
    def claim(conn: Any) -> dict[str, Any] | None:
        with conn.transaction():
            conn.execute(CLAIM_LOCK)
            return conn.execute(
                CLAIM_SHARD,
                {
                    "owner": owner,
                    "run": run_id,
                    "room": memory_room(),
                    "host": owner.split(":")[0] + ":%",
                    "task_memory": jsonb(TASK_MEMORY_GB),
                    "shard_memory": SHARD_MEMORY_GB,
                },
            ).fetchone()

    return db.call(claim)


def shard_beat(db: Db, shard: dict[str, Any], owner: str) -> bool:
    """Renews the shard's lease and counts the run's attempts. False: stop the shard."""
    mine = db.execute(
        f"""UPDATE eval_run_shard SET "leaseExpiresAt" = now() + interval '{LEASE}', "attemptCount" = %s,
              "updatedAt" = now()
            WHERE id = %s AND "leaseOwner" = %s AND status = 'running' RETURNING id""",
        (Progress.done, shard["id"], owner),
    ).fetchone()
    running = db.execute(RUN_COUNT, (shard["runId"],)).fetchone()
    return mine is not None and running is not None


def run_ids(
    dataset: Any, limit: int | None = None, skip: Callable[[Any], bool] | None = None
) -> list[str | int] | None:
    """The ids of the samples that a run uses, in id order. Some tasks shuffle their dataset
    with no seed, so each process has a different order. With `limit`, a seeded random set of
    that many samples: ids are often grouped by source or topic. `skip`: samples to leave out
    after the pick, so that the other samples stay the same. None: a sample has no id."""
    ids = [s.id for s in dataset]
    if any(i is None for i in ids):
        return None
    ids = sorted(ids, key=lambda i: (isinstance(i, str), i))
    if limit and limit < len(ids):
        picked = set(random.Random(LIMIT_SEED).sample(range(len(ids)), limit))
        ids = [i for n, i in enumerate(ids) if n in picked]
    if skip:
        left_out = {s.id for s in dataset if skip(s)}
        ids = [i for i in ids if i not in left_out]
    return ids


def shard_ids(
    dataset: Any,
    start: int,
    end: int,
    limit: int | None = None,
    skip: Callable[[Any], bool] | None = None,
) -> list[str | int] | None:
    """The ids of samples [start, end) of `run_ids`."""
    ids = run_ids(dataset, limit, skip)
    return None if ids is None else ids[start:end]


def seeded_task(name: str, args: dict[str, Any]) -> Any:
    """The task, from one dataset with seeded `random`. Some datasets make sample ids with the
    global `random` (AbstentionBench GPQA shuffles the choices into the id): each process and
    each instance has other ids."""
    state = random.getstate()
    random.seed(0)
    try:
        return registry_create("task", name, **args)
    finally:
        random.setstate(state)


def shard_task(
    name: str, args: dict[str, Any], start: int, end: int, limit: int | None = None
) -> tuple[Any, Any]:
    """The task (`seeded_task`) and the ids of its samples [start, end)."""
    task = seeded_task(name, args)
    return task, shard_ids(task.dataset, start, end, limit, SKIP_SAMPLES.get(name))


def run_shard(db: Db, bucket: Bucket, shard: dict[str, Any], owner: str) -> None:
    run_id, ordinal = str(shard["runId"]), shard["ordinal"]
    start, end = shard["sampleStart"], shard["sampleEnd"]
    run = db.execute("SELECT * FROM eval_run WHERE id = %s", (run_id,)).fetchone()
    version = version_of(db, run)
    inputs = Inputs(version["runner"], run)
    log_dir = CACHE / run_id / "shards" / str(ordinal)
    print(
        f"Run {run_id} shard {ordinal}: samples [{start}, {end}) of {inputs.task} on "
        f"{inputs.model} {inputs.model_args}",
        flush=True,
    )
    Progress.planned, Progress.done = None, 0
    watch = Watch(lambda d: shard_beat(d, shard, owner), interrupt=True)
    logs: list[EvalLog] = []
    try:
        with watch, dataset_context(db, run, version):
            ensure_entry_points()
            limit = inputs.settings.get("limit")
            task, ids = shard_task(
                inputs.task,
                inputs.task_args,
                start,
                end,
                limit if isinstance(limit, int) else None,
            )
            logs = inspect_eval(
                task,
                model=inputs.model,
                model_args=inputs.model_args,
                model_roles=inputs.roles or None,
                **({"sample_id": ids} if ids is not None else {"limit": (start, end)}),
                epochs=inputs.settings.get("epochs") or 1,
                max_connections=shard["connections"],
                temperature=inputs.settings.get("temperature"),
                max_tokens=inputs.settings.get("maxTokens"),
                **{"max_retries": MODEL_RETRIES, "timeout": MODEL_TIMEOUT, **inputs.generate},
                log_dir=str(log_dir),
                log_format="eval",
                display="plain",
                fail_on_error=False,
                retry_on_error=SAMPLE_RETRIES,
            )
    except KeyboardInterrupt:
        if not watch.stopped:
            raise
    if watch.stopped:
        stop_shard(db, shard, owner)
        return
    if not logs:
        # Inspect gives no log when the user stops it with Ctrl-C.
        raise KeyboardInterrupt
    log = logs[0]
    if log.status == "error" or log.results is None:
        first = log.error or next((s.error for s in log.samples or [] if s.error), None)
        blocks = summarize(s.error.message for s in log.samples or [] if s.error)
        message = f"No sample was scored. {note(blocks)} {first.message if first else ''}"
        raise Blocked(message.strip(), blocks) if blocks else RuntimeError(message.strip())
    key = f"runs/{run_id}/shards/{ordinal}.eval"
    bucket.put(key, Path(log.location).read_bytes(), LOG_TYPE)
    done = db.execute(
        """UPDATE eval_run_shard SET status = 'succeeded', "logKey" = %s, "attemptCount" = %s, "finishedAt" = now(),
             "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now()
           WHERE id = %s AND "leaseOwner" = %s AND status = 'running'""",
        (key, len(log.samples or []), shard["id"], owner),
    ).rowcount
    db.execute(RUN_COUNT, (run_id,))
    print(
        f"Run {run_id} shard {ordinal}: "
        + (
            f"{len(log.samples or [])} samples."
            if done
            else "lost its lease; not saved."
        ),
        flush=True,
    )


def stop_shard(db: Db, shard: dict[str, Any], owner: str) -> None:
    """Marks a shard that its heartbeat stopped. The last shard of a cancelled run sends the emails."""
    run_id = str(shard["runId"])
    db.execute(
        """UPDATE eval_run_shard SET status = 'cancelled', "attemptCount" = %s, "finishedAt" = now(),
             "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now()
           WHERE id = %s AND "leaseOwner" = %s AND status = 'running'""",
        (Progress.done, shard["id"], owner),
    )
    row = db.execute(
        """SELECT r.status, (SELECT count(*) FROM eval_run_shard s WHERE s."runId" = r.id AND s.status = 'running')
             AS running
           FROM eval_run r WHERE r.id = %s""",
        (run_id,),
    ).fetchone()
    print(
        f"Run {run_id} shard {shard['ordinal']}: stopped; the run is {row['status'] if row else 'gone'}.",
        flush=True,
    )
    if row and row["status"] == "cancelled" and row["running"] == 0:
        notify(run_id)


class Blocked(RuntimeError):
    """No sample was scored, and providers refused calls for their policy (`ProviderBlock`s)."""

    def __init__(self, message: str, blocks: list[dict[str, Any]]) -> None:
        super().__init__(message)
        self.blocks = blocks


def shard_failed(db: Db, shard: dict[str, Any], owner: str, e: BaseException) -> None:
    """Queues the shard again while it has tries left. Else the shard and its run fail. An
    account block refuses all calls, so the shard gets no more tries."""
    blocks = e.blocks if isinstance(e, Blocked) else None
    last = shard["tries"] >= MAX_TRIES or any(b["kind"] == "account" for b in blocks or [])
    if (
        db.execute(
            """UPDATE eval_run_shard SET status = %s, error = %s, "finishedAt" = CASE WHEN %s THEN now() END,
                 "leaseOwner" = NULL, "leaseExpiresAt" = NULL, "updatedAt" = now()
               WHERE id = %s AND "leaseOwner" = %s AND status = 'running'""",
            ("failed" if last else "queued", error_text(e), last, shard["id"], owner),
        ).rowcount
        and last
    ):
        fail_run(db, str(shard["runId"]), shard_error(shard, error_text(e)), blocks)


def shard_error(shard: dict[str, Any], error: str) -> str:
    return (
        f"Shard {shard['ordinal']} (samples {shard['sampleStart']} to {shard['sampleEnd'] - 1}) "
        f"failed. {error}"
    )


def sweep(db: Db) -> None:
    """Fails the runs whose shards stopped with no tries left."""
    for shard in db.execute(SWEEP).fetchall():
        fail_run(db, str(shard["runId"]), shard_error(shard, shard["error"]))


def add_usage(items: list[dict[str, ModelUsage]]) -> dict[str, ModelUsage]:
    out: dict[str, ModelUsage] = {}
    for usage in items:
        for name, u in usage.items():
            out[name] = out[name] + u if name in out else u
    return out


def metric_names(metrics: Any) -> Iterator[Any]:
    if isinstance(metrics, list):
        for m in metrics:
            yield from metric_names(m)
    elif isinstance(metrics, dict):
        for m in metrics.values():
            yield from metric_names(m)
    elif metrics is not None:
        yield getattr(metrics, "name", None)


def builtin_metrics(metrics: Any) -> bool:
    """True when all the metrics are Inspect's own (`inspect_ai/mean`). They read only the
    score values, and `grouped` also reads the sample metadata."""
    return all(
        isinstance(n, str) and n.startswith("inspect_ai/")
        for n in metric_names(metrics)
    )


def value_only_scorers(log: EvalLog) -> set[str]:
    """The scorers whose metrics and epoch reducers need only the score values. The merge keeps
    only the values of their scores, so that the metrics do not need all the score metadata in
    memory (RealToxicityPrompts keeps 25 continuations in each score)."""
    reducers = log.eval.config.epochs_reducer or []
    if not builtin_metrics(log.eval.metrics) or any("/" in r for r in reducers):
        return set()
    return {s.name for s in log.eval.scorers or [] if builtin_metrics(s.metrics)}


def uses_sample_metadata(log: EvalLog) -> bool:
    metrics = [log.eval.metrics] + [s.metrics for s in log.eval.scorers or []]
    return GROUPED in metric_names(metrics)


def shard_samples(z: zipfile.ZipFile, log: EvalLog) -> list[str]:
    """The sample members in the order of a whole read (Inspect's `sort_samples`): epoch, then
    id. Grouped metrics list their groups in the order of the samples."""
    ids = {str(i): i for i in log.eval.dataset.sample_ids or []}

    def key(name: str) -> tuple[int, str]:
        sid, _, epoch = (
            name.removeprefix(SAMPLES).removesuffix(".json").rpartition("_epoch_")
        )
        i = ids.get(sid, sid)
        return (int(epoch), i if isinstance(i, str) else str(i).zfill(20))

    return sorted({n for n in z.namelist() if n.startswith(SAMPLES)}, key=key)


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def write_array(w: Any, items: Iterator[bytes]) -> None:
    """A JSON array, written one item at a time."""
    w.write(b"[")
    for i, item in enumerate(items):
        w.write(b"," + item if i else item)
    w.write(b"]")


def write_summaries(dst: zipfile.ZipFile, zips: list[zipfile.ZipFile]) -> None:
    """The items of each shard's summary array, as they are."""

    def items() -> Iterator[bytes]:
        for z in zips:
            if SUMMARIES_JSON in z.NameToInfo and (
                inner := z.read(SUMMARIES_JSON).strip()[1:-1].strip()
            ):
                yield inner

    with dst.open(SUMMARIES_JSON, "w", force_zip64=True) as w:
        write_array(w, items())


def write_reductions(dst: zipfile.ZipFile, zips: list[zipfile.ZipFile]) -> None:
    """One reduction per scorer and reducer, with the samples of all the shards. A sample's
    reduction does not depend on other samples."""

    def reductions(z: zipfile.ZipFile) -> list[dict[str, Any]]:
        if REDUCTIONS_JSON not in z.NameToInfo:
            return []
        return json.loads(z.read(REDUCTIONS_JSON))

    keys = dict.fromkeys(
        (r["scorer"], r.get("reducer")) for z in zips for r in reductions(z)
    )
    if not keys:
        return

    def samples(key: tuple[str, str | None]) -> Iterator[bytes]:
        for z in zips:
            for r in reductions(z):
                if (r["scorer"], r.get("reducer")) == key:
                    yield from (json_bytes(s) for s in r["samples"])

    with dst.open(REDUCTIONS_JSON, "w", force_zip64=True) as w:
        w.write(b"[")
        for i, (scorer, reducer) in enumerate(keys):
            head = {"scorer": scorer} | (
                {"reducer": reducer} if reducer is not None else {}
            )
            w.write((b"," if i else b"") + json_bytes(head)[:-1] + b',"samples":')
            write_array(w, samples((scorer, reducer)))
            w.write(b"}")
        w.write(b"]")


def merge_shards(
    paths: list[Path],
    out: Path,
    limit: int | None = None,
    errors: list[str] | None = None,
    empty: list[str] | None = None,
) -> int:
    """Writes one log from the logs of a run's shards, in shard order, one sample at a time. The
    metrics are computed again from all the samples' scores, with the task's reducers and
    metrics. No model calls. Gives the sample count, adds the sample errors to `errors`, and adds
    to `empty` the ids of samples with no error and no tokens from the target model."""
    headers = [read_header(p) for p in paths]
    merged = headers[0]
    merged.eval.dataset.sample_ids = [
        i for h in headers for i in h.eval.dataset.sample_ids or []
    ]
    merged.eval.config.limit = limit
    bad = next((h for h in headers if h.status != "success"), None)
    merged.status = bad.status if bad else "success"
    merged.error = bad.error if bad else None
    started = [h.stats.started_at for h in headers if h.stats.started_at]
    completed = [h.stats.completed_at for h in headers if h.stats.completed_at]
    merged.stats.started_at = min(started) if started else ""
    merged.stats.completed_at = max(completed) if completed else ""
    merged.stats.model_usage = add_usage([h.stats.model_usage for h in headers])
    merged.stats.role_usage = add_usage([h.stats.role_usage for h in headers])
    ensure_entry_points()
    value_only = value_only_scorers(merged)
    grouped = uses_sample_metadata(merged)
    scores: list[dict[str, SampleScore]] = []
    count = done = 0
    with contextlib.ExitStack() as stack:
        zips = [stack.enter_context(zipfile.ZipFile(p)) for p in paths]
        members = [shard_samples(z, h) for z, h in zip(zips, headers)]
        names = [n for m in members for n in m]
        if len(set(names)) < len(names):
            raise RuntimeError("Two shard logs have the same sample.")
        dst = stack.enter_context(zipfile.ZipFile(out, "w", **zipfile_compress_kwargs))
        for z, shard_names in zip(zips, members):
            for name in shard_names:
                info = z.getinfo(name)
                data = z.read(info)
                copy = zipfile.ZipInfo(name, date_time=info.date_time)
                copy.compress_type = info.compress_type
                dst.writestr(copy, data)
                sample = json.loads(data)
                del data
                count += 1
                done += sample.get("error") is None
                if errors is not None and sample.get("error"):
                    errors.append(sample["error"].get("message") or "")
                if empty is not None and not sample.get("error"):
                    u = (sample.get("model_usage") or {}).get(merged.eval.model) or {}
                    if not any(u.get(k) for k in USAGE_TOKENS):
                        empty.append(str(sample["id"]))
                if sample.get("scores"):
                    scores.append(
                        {
                            k: SampleScore(
                                score=Score(value=v["value"])
                                if k in value_only
                                else Score.model_validate(v),
                                sample_id=sample["id"],
                                sample_metadata=sample.get("metadata")
                                if grouped or k not in value_only
                                else None,
                            )
                            for k, v in sample["scores"].items()
                        }
                    )
        merged.results, _ = eval_results(
            samples=count,
            scores=scores,
            reducers=reducers_from_log_header(merged),
            scorers=resolve_scorers_info(merged),
            metrics=metrics_from_log_header(merged),
            early_stopping=merged.results.early_stopping if merged.results else None,
            metadata=merged.results.metadata if merged.results else None,
            logged_samples=merged.results.logged_samples if merged.results else None,
            completed_samples=done,
            headline_metric=merged.eval.headline_metric,
        )
        write_summaries(dst, zips)
        write_reductions(dst, zips)
        start = LogStart(version=merged.version, eval=merged.eval, plan=merged.plan)
        dst.writestr(f"{JOURNAL_DIR}/{START_JSON}", to_json_safe(start, indent=None))
        header = EvalLog(
            version=merged.version,
            invalidated=merged.invalidated,
            log_updates=merged.log_updates,
            config_updates=merged.config_updates,
            eval=merged.eval,
            plan=merged.plan,
            results=merged.results,
            stats=merged.stats,
            status=merged.status,
            error=merged.error,
        )
        dst.writestr(HEADER_JSON, to_json_safe(header, indent=None))
    return count


def import_run(db: Db, bucket: Bucket, path: Path, run_id: str) -> None:
    def save(conn: Any) -> None:
        try:
            import_log(conn, bucket, path, run_id=run_id)
        except SystemExit as e:
            raise RuntimeError(str(e)) from None

    db.call(save)


def run_beat(db: Db, run_id: str, owner: str) -> bool:
    """Renews the run's lease. False: the run is no longer this runner's to finish."""
    return (
        db.execute(
            f"""UPDATE eval_run SET "leaseExpiresAt" = now() + interval '{LEASE}', "attemptCount" = %s,
                  "sampleCount" = coalesce(%s, "sampleCount"), "updatedAt" = now()
                WHERE id = %s AND "leaseOwner" = %s AND status IN ('running', 'importing') RETURNING id""",
            (Progress.done, Progress.planned, run_id, owner),
        ).fetchone()
        is not None
    )


def finish(db: Db, bucket: Bucket, run: dict[str, Any], owner: str) -> None:
    """Merges the shard logs of the run and imports the merged log."""
    run_id = str(run["id"])
    shards = db.execute(
        'SELECT ordinal, "logKey" FROM eval_run_shard WHERE "runId" = %s ORDER BY ordinal',
        (run_id,),
    ).fetchall()
    log_dir = CACHE / run_id
    log_dir.mkdir(parents=True, exist_ok=True)
    Progress.planned, Progress.done = run["sampleCount"], run["attemptCount"]
    with Watch(lambda d: run_beat(d, run_id, owner)):
        paths = []
        for shard in shards:
            path = log_dir / f"shard-{shard['ordinal']}.eval"
            path.write_bytes(bucket.get(shard["logKey"]))
            paths.append(path)
        limit = run["settings"].get("limit")
        out = log_dir / "merged.eval"
        errors: list[str] = []
        empty: list[str] = []
        count = merge_shards(paths, out, limit if isinstance(limit, int) else None, errors, empty)
        if run["sampleCount"] and count != run["sampleCount"]:
            print(
                f"Run {run_id}: {count} samples in the shard logs, not {run['sampleCount']}.",
                flush=True,
            )
        blocks = summarize(errors)
        db.execute(
            """UPDATE eval_run SET provenance = coalesce(provenance, '{}'::jsonb) || %s WHERE id = %s""",
            (
                jsonb(
                    {"erroredSamples": len(errors), "emptySamples": len(empty)}
                    | ({"blocks": blocks} if blocks else {})
                ),
                run_id,
            ),
        )
        if count and len(errors) > count * MAX_ERRORED:
            fail_run(
                db,
                run_id,
                f"{len(errors)} of {count} samples have an error and no score. {note(blocks)}".strip(),
                blocks,
            )
            return
        if count and len(empty) > count * MAX_EMPTY:
            fail_run(
                db,
                run_id,
                f"{len(empty)} of {count} samples got no reply from the target model (no tokens), "
                "for example when each call to it failed. The scores would rest on empty transcripts.",
            )
            return
        import_run(db, bucket, out, run_id)
    notify(run_id)


def typed_metadata(log: EvalLog, dataset: Any) -> None:
    """A log keeps enums in sample metadata as their values, and model outputs in the store as
    dicts. Some scorers (MASK) need the objects: enums come from the task's dataset again."""
    by_id = {s.id: s.metadata or {} for s in dataset}

    def output(v: Any) -> Any:
        if isinstance(v, list):
            return [output(x) for x in v]
        if isinstance(v, dict) and {"model", "choices"} <= v.keys():
            return ModelOutput.model_validate(v)
        return v

    for s in log.samples or []:
        for k, v in by_id.get(s.id, {}).items():
            if isinstance(v, Enum) and (s.metadata or {}).get(k) == v.value:
                s.metadata[k] = v
        for k, v in (s.store or {}).items():
            s.store[k] = output(v)


def limit_samples(log: EvalLog, ids: list[str | int] | None, limit: int) -> None:
    """Keeps the log's samples that a run with this limit has (`shard_ids`). With no ids: the
    first `limit` samples."""
    if ids is None:
        log.samples = (log.samples or [])[:limit]
        return
    keep = set(ids)
    log.samples = [s for s in log.samples or [] if s.id in keep]
    if missing := keep - {s.id for s in log.samples}:
        print(f"The source log has no samples for {len(missing)} of the {limit} ids.", flush=True)


def rescore(
    db: Db,
    bucket: Bucket,
    run: dict[str, Any],
    inputs: Inputs,
    log_dir: Path,
) -> str:
    """Scores the source run's log again with the task's scorers. The target's outputs stay."""
    source = db.execute(
        'SELECT "logKey" FROM eval_run WHERE id = %s', (run["sourceRunId"],)
    ).fetchone()
    if not source or not source["logKey"]:
        raise RuntimeError("The source run has no log.")
    log_dir.mkdir(parents=True, exist_ok=True)
    source_path = log_dir / "source.eval"
    source_path.write_bytes(bucket.get(source["logKey"]))
    log = read_eval_log(str(source_path))
    print(
        f"Run {run['id']}: re-score {inputs.task} from run {run['sourceRunId']}",
        flush=True,
    )
    ensure_entry_points()
    task_args = inputs.task_args
    limit = run["settings"].get("limit")
    limit = limit if isinstance(limit, int) else None
    task, ids = shard_task(inputs.task, task_args, 0, limit or 0, limit)
    if limit:
        limit_samples(log, ids, limit)
    Progress.planned = len(log.samples or [])
    typed_metadata(log, task.dataset)
    scorers = task.scorer
    new = score(
        log, scorers=scorers, model_roles=inputs.roles or None, action="overwrite"
    )
    new.eval.task_args = {
        **(new.eval.task_args or {}),
        **{
            k: [str(m) for m in v] if isinstance(v, list) else str(v)
            for k, v in task_args.items()
            if isinstance(v, (Model, list))
        },
    }
    Progress.done = Progress.planned
    out = log_dir / "rescored.eval"
    write_eval_log(new, str(out))
    return str(out)


def run_rescore(db: Db, bucket: Bucket, run: dict[str, Any], owner: str) -> None:
    run_id = str(run["id"])
    version = version_of(db, run)
    inputs = Inputs(version["runner"], run)
    db.execute(
        "UPDATE eval_run SET provenance = %s WHERE id = %s",
        (jsonb({"host": socket.gethostname(), "runnerVersion": __version__}), run_id),
    )
    Progress.planned, Progress.done = None, 0
    with Watch(lambda d: run_beat(d, run_id, owner)), dataset_context(db, run, version):
        location = rescore(db, bucket, run, inputs, CACHE / run_id)
    db.execute(
        f"""UPDATE eval_run SET status = 'importing', "attemptCount" = %s, "leaseExpiresAt" = now() + interval '{LEASE}'
            WHERE id = %s AND status <> 'cancelled'""",
        (Progress.done, run_id),
    )
    import_run(db, bucket, Path(location), run_id)
    notify(run_id)


def step(db: Db, bucket: Bucket, owner: str, run_id: str | None) -> bool:
    """Does one piece of work. False: there is nothing to do now."""
    args = {"owner": owner, "run": run_id}
    sweep(db)
    if run := db.execute(PLAN, args).fetchone():
        try:
            plan(db, run, owner)
        except Exception as e:  # noqa: BLE001 - any error fails the run, not the runner.
            traceback.print_exc()
            sentry_sdk.capture_exception(e)
            plan_failed(db, run, e)
        return True
    if run := db.execute(FINISH, args).fetchone():
        try:
            finish(db, bucket, run, owner)
        except RunCancelled as e:
            print(e, flush=True)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            sentry_sdk.capture_exception(e)
            fail_run(
                db,
                str(run["id"]),
                f"The merge of the shard logs failed. {error_text(e)}",
            )
        return True
    if shard := claim_shard(db, owner, run_id):
        try:
            run_shard(db, bucket, shard, owner)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            sentry_sdk.capture_exception(e)
            shard_failed(db, shard, owner, e)
        return True
    if run := db.execute(CLAIM, args).fetchone():
        try:
            run_rescore(db, bucket, run, owner)
        except RunCancelled as e:
            print(e, flush=True)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            sentry_sdk.capture_exception(e)
            fail_run(db, str(run["id"]), error_text(e))
        return True
    return False


def waiting(db: Db, run_id: str, standby: bool = False) -> tuple[str, bool] | None:
    """Why a runner of this run must wait, and True when the wait has no time limit. None: the
    run has nothing more for it. A standby runner waits while other runners' shards run, so
    that it can take a shard whose runner stops."""
    row = db.execute(
        f"""SELECT r.status, r."leaseExpiresAt" > now() AS leased, count(s.id) AS shards,
              count(s.id) FILTER (WHERE s.status = 'queued'
                OR (s.status = 'running' AND s."leaseExpiresAt" < now() AND s.tries < {MAX_TRIES})) AS open,
              count(s.id) FILTER (WHERE s.status = 'running' AND s."leaseExpiresAt" >= now()
                AND s.tries < {MAX_TRIES}) AS live
            FROM eval_run r LEFT JOIN eval_run_shard s ON s."runId" = r.id
            WHERE r.id = %s GROUP BY r.id""",
        (run_id,),
    ).fetchone()
    if not row or row["status"] != "running":
        return None
    if row["open"]:
        return f"{row['open']} shards {ROOM_WAIT}", standby and row["live"] > 0
    if row["shards"] == 0 and row["leased"]:
        return "another runner plans the run", False
    if standby and row["live"]:
        return f"{row['live']} shards run on other runners", True
    return None


def work(
    once: bool = False,
    poll: float = 5.0,
    run_id: str | None = None,
    exit_when_idle: bool = False,
    standby: bool = False,
) -> None:
    """Runs queued work. With `run_id`, only that run's work; with `exit_when_idle`, stops
    when there is none. With `standby` too, waits until no other runner has a shard of it."""
    # Containers can have the same pid, so the owner also gets a random part.
    owner = f"{host_key()}:{os.getpid()}:{uuid7().hex[-6:]}"
    bucket = open_bucket()
    code = CodeWatch()
    waited, delay = 0.0, 5.0
    # A process that ran a shard keeps much of its memory, so the memory check can block the next.
    worked = False
    with Db() as db:
        print(
            f"Runner {owner} waiting for {'run ' + run_id if run_id else 'runs'}.",
            flush=True,
        )
        while True:
            if step(db, bucket, owner, run_id):
                waited, delay = 0.0, 5.0
                worked = True
                if once:
                    return
                continue
            if exit_when_idle:
                found = waiting(db, run_id, standby) if run_id else None
                if found is None:
                    print(f"Runner {owner}: no more work. Stop.", flush=True)
                    return
                reason, endless = found
                if worked and reason.endswith(ROOM_WAIT):
                    restart(f"Runner {owner}", f"{reason}; free the memory of the last shard")
                if waited >= CAP_WAIT and not endless:
                    print(
                        f"Runner {owner}: {reason} after {waited:.0f} s. Stop.",
                        flush=True,
                    )
                    return
                print(f"Runner {owner}: {reason}; wait {delay:.0f} s.", flush=True)
                time.sleep(delay)
                waited, delay = waited + delay, min(delay * 2, 60)
                continue
            if once:
                return
            restart_if_changed(code, f"Runner {owner}")
            time.sleep(poll)
