"""Shards, the merge of shard logs, the heartbeat stop and the reconnect. Inspect's mock
model; no network and no database."""

import asyncio
import json
import os
import threading
import tracemalloc
from collections.abc import Callable
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import psycopg
import pytest
from inspect_ai import Epochs, Task, task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.log import (
    EvalError,
    EvalLog,
    EvalSampleReductions,
    EvalSampleScore,
    read_eval_log,
    read_eval_log_sample_summaries,
    recompute_metrics,
    write_eval_log,
)
from inspect_ai.scorer import (
    SampleScore,
    Score,
    Target,
    includes,
    mean,
    metric,
    scorer,
    stderr,
)
from inspect_ai.solver import Generate, TaskState, generate, solver

from openaudit_runner import store, work


@scorer(metrics=[mean(), stderr()])
def id_value():
    async def score(state: TaskState, target: Target) -> Score:
        return Score(value=int(state.sample_id) % 3 / 2)

    return score


def tiny(n: int = 10) -> Task:
    # The mock model always says "Default output from mockllm/model".
    samples = [
        Sample(id=i, input=f"Q{i}", target="Default" if i % 2 else "nope")
        for i in range(n)
    ]
    return Task(
        dataset=MemoryDataset(samples),
        solver=generate(),
        scorer=[includes(), id_value()],
        epochs=Epochs(2, "mean"),
    )


def run(tmp_path, limit=None):
    [log] = inspect_eval(
        tiny(),
        model="mockllm/model",
        limit=limit,
        log_dir=str(tmp_path),
        display="none",
    )
    assert log.status == "success"
    return log


def metrics(log) -> dict[str, float]:
    return {
        f"{s.name}/{m.name}": round(m.value, 9)
        for s in log.results.scores
        for m in s.metrics.values()
    }


def test_tuple_limit_is_a_zero_based_half_open_slice(tmp_path):
    log = run(tmp_path, limit=(2, 5))
    assert sorted({s.id for s in log.samples}) == [2, 3, 4]
    assert log.eval.dataset.sample_ids == [2, 3, 4]


def test_typed_metadata_gives_back_enums():
    from enum import Enum
    from types import SimpleNamespace

    from inspect_ai.log import EvalSample

    class Kind(str, Enum):
        STATS = "statistics"

    dataset = [Sample(id=1, input="q", metadata={"config": Kind.STATS, "n": 2})]
    from inspect_ai.model import ModelOutput

    out = ModelOutput.from_content("m", "hi").model_dump()
    sample = EvalSample(
        id=1,
        epoch=1,
        input="q",
        target="",
        metadata={"config": "statistics", "n": 3},
        store={"responses": [out], "k": 1},
    )
    work.typed_metadata(SimpleNamespace(samples=[sample]), dataset)
    assert sample.metadata["config"] is Kind.STATS
    assert sample.metadata["n"] == 3
    assert sample.store["responses"][0].message.text == "hi"
    assert sample.store["k"] == 1


def test_shards_by_id_cover_a_shuffled_dataset_once(tmp_path):
    def shuffled() -> Task:
        task = tiny(9)
        task.dataset.shuffle()
        return task

    seen = []
    for start, end in [(0, 4), (4, 9)]:
        ids = work.shard_ids(shuffled().dataset, start, end)
        [log] = inspect_eval(
            shuffled(),
            model="mockllm/model",
            sample_id=ids,
            log_dir=str(tmp_path),
            display="none",
        )
        seen += sorted({s.id for s in log.samples})
    assert seen == list(range(9))
    with pytest.raises(RuntimeError, match="same sample"):
        work.merge_shards([Path(log.location)] * 2, tmp_path / "merged.eval")
    assert work.shard_ids(MemoryDataset([Sample(input="x")]), 0, 1) is None


def test_a_limit_takes_the_same_random_samples_in_each_shard():
    grouped = MemoryDataset(
        [Sample(input="x", id=f"{g}_{n:03}") for g in "abcd" for n in range(100)]
    )
    picked = work.shard_ids(grouped, 0, 3, limit=40) + work.shard_ids(
        grouped, 3, 40, limit=40
    )
    assert picked == work.shard_ids(grouped, 0, 40, limit=40)
    assert len(set(picked)) == 40 and picked == sorted(picked)
    assert {i[0] for i in picked} == set("abcd")
    assert work.shard_ids(grouped, 0, 400, limit=500) == work.shard_ids(grouped, 0, 400)


def test_skipped_samples_leave_the_other_picks_the_same():
    grouped = MemoryDataset(
        [
            Sample(input="x", id=f"{g}_{n:03}", metadata={"dataset_name": g})
            for g in "abcd"
            for n in range(100)
        ]
    )
    skip = work.SKIP_SAMPLES["inspect_evals/abstention_bench"]
    assert not any(skip(s) for s in grouped)
    gpqa = MemoryDataset(
        [*grouped, *(Sample(input="x", id=f"GPQA_{n}", metadata={"dataset_name": "GPQA"}) for n in range(9))]
    )
    picked = work.run_ids(gpqa, 40)
    kept = work.run_ids(gpqa, 40, skip)
    assert kept == [i for i in picked if not str(i).startswith("GPQA")]
    assert work.shard_ids(gpqa, 0, 5, 40, skip) + work.shard_ids(gpqa, 5, 40, 40, skip) == kept


def test_a_limited_rescore_keeps_the_samples_of_a_limited_run():
    from types import SimpleNamespace

    grouped = MemoryDataset(
        [Sample(input="x", id=f"{g}_{n:03}") for g in "abcd" for n in range(100)]
    )
    ids = work.shard_ids(grouped, 0, 40, limit=40)
    log = SimpleNamespace(samples=[SimpleNamespace(id=s.id) for s in grouped])
    work.limit_samples(log, ids, 40)
    assert [s.id for s in log.samples] == ids
    fewer = SimpleNamespace(samples=log.samples[1:])
    work.limit_samples(fewer, ids, 40)
    assert [s.id for s in fewer.samples] == ids[1:]


def test_a_target_in_a_role_gets_the_run_generate_settings():
    thinking = {"extra_body": {"chat_template_kwargs": {"enable_thinking": True}}}
    config = work.role_config({"maxTokens": 32768, "temperature": 0.5}, thinking)
    assert config.max_tokens == 32768 and config.temperature == 0.5
    assert config.timeout == work.MODEL_TIMEOUT and config.max_retries == work.MODEL_RETRIES
    assert config.extra_body == thinking["extra_body"]
    assert work.role_config({}, {}).max_tokens is None


def merge(tmp_path, shards, limit=None):
    out = tmp_path / "merged.eval"
    count = work.merge_shards([Path(s.location) for s in shards], out, limit)
    log = read_eval_log(str(out))
    assert count == len(log.samples)
    return log


def test_merged_shards_give_the_metrics_of_one_log(tmp_path):
    whole = run(tmp_path / "whole")
    shards = [run(tmp_path / "a", (0, 4)), run(tmp_path / "b", (4, 10))]
    merged = merge(tmp_path, shards)
    assert metrics(merged) == metrics(whole)
    assert len(metrics(whole)) == 4
    assert merged.eval.dataset.sample_ids == whole.eval.dataset.sample_ids
    assert len(merged.samples) == len(whole.samples) == 20
    assert merged.results.total_samples == whole.results.total_samples
    assert merged.results.completed_samples == whole.results.completed_samples
    assert merged.eval.config.limit is None
    assert merged.status == "success"


def test_merge_gives_the_sample_errors(tmp_path):
    shard = run(tmp_path / "a", (0, 4))
    shard.samples[1].error = EvalError(message="Error code: 403 - blocked", traceback="", traceback_ansi="")
    path = tmp_path / "errored.eval"
    write_eval_log(shard, str(path))
    errors: list[str] = []
    work.merge_shards([path], tmp_path / "merged.eval", errors=errors)
    assert errors == ["Error code: 403 - blocked"]


def test_merge_gives_the_samples_with_no_target_reply(tmp_path):
    from inspect_ai.model import ModelUsage

    shard = run(tmp_path / "a", (0, 4))
    for s in shard.samples:
        s.model_usage = {shard.eval.model: ModelUsage(input_tokens=5, output_tokens=3, total_tokens=8)}
    shard.samples[1].model_usage = {}
    shard.samples[2].model_usage = {shard.eval.model: ModelUsage()}
    shard.samples[3].model_usage = {}
    shard.samples[3].error = EvalError(message="failed", traceback="", traceback_ansi="")
    path = tmp_path / "empty.eval"
    write_eval_log(shard, str(path))
    empty: list[str] = []
    work.merge_shards([path], tmp_path / "merged.eval", empty=empty)
    assert empty == [str(shard.samples[1].id), str(shard.samples[2].id)]


def reference_merge(logs: list[EvalLog]) -> EvalLog:
    """The merge before it streamed: all the samples in memory."""
    merged = logs[0]
    merged.samples = [s for log in logs for s in log.samples or []]
    merged.eval.dataset.sample_ids = [
        i for log in logs for i in log.eval.dataset.sample_ids or []
    ]
    merged.eval.config.limit = None
    merged.stats.model_usage = work.add_usage([log.stats.model_usage for log in logs])
    merged.stats.role_usage = work.add_usage([log.stats.role_usage for log in logs])
    recompute_metrics(merged)
    return merged


def dump(x) -> object:
    return json.loads(x.model_dump_json(exclude_none=True))


def by_key(samples) -> dict:
    return {(str(s.id), s.epoch): dump(s) for s in samples}


def test_streaming_merge_gives_the_log_of_the_merge_in_memory(tmp_path):
    shards = [run(tmp_path / "a", (0, 4)), run(tmp_path / "b", (4, 10))]
    new = merge(tmp_path, shards)
    old = reference_merge([read_eval_log(s.location) for s in shards])
    assert dump(new.results) == dump(old.results)
    assert {k: dump(v) for k, v in new.stats.model_usage.items()} == {
        k: dump(v) for k, v in old.stats.model_usage.items()
    }
    assert by_key(new.samples) == by_key(old.samples)

    def reductions(log):
        return sorted(
            (r.scorer, r.reducer, sorted(map(dump, r.samples), key=str))
            for r in log.reductions
        )

    assert reductions(new) == reductions(old)
    old_summaries = read_eval_log_sample_summaries(shards[0].location)
    old_summaries += read_eval_log_sample_summaries(shards[1].location)
    new_summaries = read_eval_log_sample_summaries(str(tmp_path / "merged.eval"))
    assert by_key(new_summaries) == by_key(old_summaries)


@metric
def answer_rate():
    """A metric that reads the score's answer and metadata, not only its value."""

    def compute(scores: list[SampleScore]) -> float:
        return sum(
            s.score.answer == "a" and s.score.metadata["w"] for s in scores
        ) / len(scores)

    return compute


@scorer(metrics=[mean(), answer_rate()])
def with_metadata():
    async def score(state: TaskState, target: Target) -> Score:
        i = int(state.sample_id)
        return Score(value=i, answer="a" if i % 2 else "b", metadata={"w": i % 3})

    return score


def test_merge_keeps_what_custom_metrics_read(tmp_path):
    def task() -> Task:
        task = tiny()
        task.scorer = [with_metadata(), includes()]
        return task

    def go(path, limit=None):
        [log] = inspect_eval(
            task(),
            model="mockllm/model",
            limit=limit,
            log_dir=str(path),
            display="none",
        )
        return log

    whole = go(tmp_path / "whole")
    merged = merge(tmp_path, [go(tmp_path / "a", (0, 3)), go(tmp_path / "b", (3, 10))])
    assert metrics(merged) == metrics(whole)
    assert metrics(merged)["with_metadata/answer_rate"] > 0
    assert work.value_only_scorers(merged) == {"includes"}


def big_shard(
    path, base: EvalLog, ids: range, pad: int, reductions: bool = False
) -> Path:
    """A log of len(ids) copies of one sample, each with `pad` bytes in its store (and in the
    score metadata of its reduction)."""
    log = base.model_copy(deep=True)
    log.samples = [
        base.samples[0].model_copy(
            update={"id": i, "epoch": 1, "store": {"pad": os.urandom(pad // 2).hex()}}
        )
        for i in ids
    ]
    log.eval.dataset.sample_ids = list(ids)
    log.eval.config.epochs = 1
    log.reductions = None
    if reductions:
        log.reductions = [
            EvalSampleReductions(
                scorer=name,
                samples=[
                    EvalSampleScore(
                        value=1,
                        sample_id=i,
                        metadata={"pad": os.urandom(pad // 2).hex()},
                    )
                    for i in ids
                ],
            )
            for name in base.samples[0].scores
        ]
    write_eval_log(log, str(path))
    return path


def peak_bytes(fn) -> int:
    tracemalloc.start()
    try:
        fn()
        return tracemalloc.get_traced_memory()[1]
    finally:
        tracemalloc.stop()


PAD = 100_000


def grows_less_than_samples(peak: Callable[[int], int], small: int, large: int) -> None:
    """Memory may grow by the scores of each sample, not by the samples."""
    growth = peak(large) - peak(small)
    assert growth < (large - small) * PAD / 10, growth


def test_merge_memory_does_not_grow_with_the_samples(tmp_path):
    base = run(tmp_path / "base")

    def peak(n: int) -> int:
        d = tmp_path / str(n)
        d.mkdir()
        paths = [
            big_shard(d / "a.eval", base, range(n), PAD),
            big_shard(d / "b.eval", base, range(n, 2 * n), PAD),
        ]
        return peak_bytes(lambda: work.merge_shards(paths, d / "merged.eval"))

    grows_less_than_samples(lambda n: peak(n // 2), 100, 1000)


@solver
def slow():
    async def solve(state: TaskState, generate: Generate) -> TaskState:
        await asyncio.sleep(0.5)
        return await generate(state)

    return solve


def test_heartbeat_stops_the_eval(tmp_path, monkeypatch):
    monkeypatch.setattr(work, "BEAT_SECONDS", 0.3)
    task = Task(
        dataset=MemoryDataset([Sample(input="x") for _ in range(40)]), solver=slow()
    )
    watch = work.Watch(lambda db: False, interrupt=True)
    logs = []
    with watch:
        logs = inspect_eval(
            task,
            model="mockllm/model",
            max_samples=2,
            log_dir=str(tmp_path),
            display="none",
        )
    assert watch.stopped
    assert not logs or logs[0].status == "cancelled"


def test_heartbeat_without_interrupt_does_not_stop(monkeypatch):
    monkeypatch.setattr(work, "BEAT_SECONDS", 0.05)
    beats = []
    with work.Watch(lambda db: beats.append(1) or False) as watch:
        threading.Event().wait(0.3)
    assert beats and not watch.stopped


class FakeConn:
    def __init__(self, fail: bool) -> None:
        self.fail, self.closed, self.broken = fail, False, False

    def execute(self, query, params=None):
        if self.fail:
            self.broken = True
            raise psycopg.OperationalError(
                "consuming input failed: SSL connection has been closed unexpectedly"
            )
        if query == "TIMEOUT":
            raise psycopg.errors.QueryCanceled(
                "canceling statement due to statement timeout"
            )
        return query

    def close(self) -> None:
        self.closed = True


def test_db_connects_again_after_a_lost_connection(monkeypatch):
    conns = [FakeConn(True), FakeConn(False)]
    made = []
    monkeypatch.setattr(
        store, "connect", lambda: made.append(1) or conns[len(made) - 1]
    )
    monkeypatch.setattr(store.time, "sleep", lambda s: None)
    db = store.Db()
    assert db.execute("SELECT 1") == "SELECT 1"
    assert len(made) == 2 and conns[0].closed


def test_db_does_not_retry_other_errors(monkeypatch):
    monkeypatch.setattr(store, "connect", lambda: FakeConn(False))
    with pytest.raises(ZeroDivisionError):
        store.Db().call(lambda conn: 1 / 0)


def test_db_connects_again_once_when_a_table_changed_under_a_plan(monkeypatch):
    made = []
    monkeypatch.setattr(store, "connect", lambda: made.append(1) or FakeConn(False))
    calls = []

    def fn(conn):
        calls.append(conn)
        if len(calls) == 1:
            raise psycopg.errors.FeatureNotSupported("cached plan must not change result type")
        return "ok"

    assert store.Db().call(fn) == "ok"
    assert len(made) == 2 and calls[0].closed

    def always(conn):
        raise psycopg.errors.FeatureNotSupported("cached plan must not change result type")

    with pytest.raises(psycopg.errors.FeatureNotSupported):
        store.Db().call(always)


def test_db_does_not_retry_a_timeout_on_a_good_connection(monkeypatch):
    made = []
    monkeypatch.setattr(store, "connect", lambda: made.append(1) or FakeConn(False))
    with pytest.raises(psycopg.errors.QueryCanceled):
        store.Db().execute("TIMEOUT")
    assert len(made) == 1


def test_notify_posts_the_run_id(monkeypatch):
    got = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            got["path"] = self.path
            got["auth"] = self.headers["Authorization"]
            got["agent"] = self.headers["User-Agent"]
            got["body"] = json.loads(
                self.rfile.read(int(self.headers["Content-Length"]))
            )
            self.send_response(204)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.handle_request, daemon=True).start()
    monkeypatch.setenv("OPENAUDIT_URL", f"http://127.0.0.1:{server.server_port}/")
    monkeypatch.setenv("RUNNER_NOTIFY_TOKEN", "t0k")
    work.notify("run-1")
    server.server_close()
    assert got == {
        "path": "/api/runner/notify",
        "auth": "Bearer t0k",
        "agent": "openaudit-runner",
        "body": {"runId": "run-1"},
    }


def test_notify_without_settings_or_server_goes_on(monkeypatch):
    monkeypatch.delenv("OPENAUDIT_URL", raising=False)
    work.notify("run-1")
    monkeypatch.setenv("OPENAUDIT_URL", "http://127.0.0.1:9")
    monkeypatch.setenv("RUNNER_NOTIFY_TOKEN", "t0k")
    work.notify("run-1")


@task
def random_ids() -> Task:
    # Ids from the global `random`, as AbstentionBench GPQA makes them.
    import random

    return Task(
        dataset=MemoryDataset(
            [Sample(id=f"s{random.random():.6f}", input="Q") for _ in range(6)]
        ),
        solver=generate(),
    )


def test_shard_task_ids_are_the_same_in_each_instance():
    import random

    random.seed(1)
    before = random.random()
    random.seed(1)
    task, first = work.shard_task("random_ids", {}, 0, 3)
    _, second = work.shard_task("random_ids", {}, 3, 6)
    assert random.random() == before
    assert sorted(first + second) == sorted(str(s.id) for s in task.dataset)
    assert set(first) <= {s.id for s in task.dataset}


def test_memory_room_is_free_memory_less_the_reserve(monkeypatch):
    monkeypatch.setenv("OPENAUDIT_MEMORY_RESERVE_GB", "0")
    free = work.memory_room()
    assert free is not None and free > 0
    monkeypatch.setenv("OPENAUDIT_MEMORY_RESERVE_GB", "4")
    assert abs(work.memory_room() - (free - 4)) < 1


def test_containers_with_the_same_host_name_get_different_host_keys(monkeypatch, tmp_path):
    monkeypatch.setattr(work.socket, "gethostname", lambda: "cloudchamber")
    keys = []
    for boot in ("aaaaaaaa-1111", "bbbbbbbb-2222"):
        (tmp_path / boot).write_text(boot + "\n")
        keys.append(work.host_key(tmp_path / boot))
    assert keys == ["cloudchamber-aaaaaaaa", "cloudchamber-bbbbbbbb"]
    assert work.host_key(tmp_path / "missing") == "cloudchamber"
    assert ":" not in work.host_key()


@pytest.mark.parametrize(
    ("row", "standby", "found"),
    [
        ({"status": "running", "leased": False, "shards": 4, "open": 0, "live": 2}, False, None),
        ({"status": "running", "leased": False, "shards": 4, "open": 0, "live": 2}, True, ("2 shards run on other runners", True)),
        ({"status": "running", "leased": False, "shards": 4, "open": 0, "live": 0}, True, None),
        ({"status": "running", "leased": False, "shards": 4, "open": 3, "live": 1}, False, ("3 shards wait for room in their caps or in memory", False)),
        ({"status": "running", "leased": False, "shards": 4, "open": 3, "live": 1}, True, ("3 shards wait for room in their caps or in memory", True)),
        ({"status": "running", "leased": False, "shards": 4, "open": 3, "live": 0}, True, ("3 shards wait for room in their caps or in memory", False)),
        ({"status": "running", "leased": True, "shards": 0, "open": 0, "live": 0}, True, ("another runner plans the run", False)),
        ({"status": "importing", "leased": True, "shards": 4, "open": 0, "live": 0}, True, None),
    ],
)
def test_a_standby_runner_waits_while_other_runners_have_shards(row, standby, found):
    class FakeDb:
        def execute(self, sql, args):
            return type("R", (), {"fetchone": lambda self: row})()

    assert work.waiting(FakeDb(), "r", standby) == found


def test_an_account_block_fails_the_shard_at_once(monkeypatch):
    calls = []

    class FakeDb:
        def execute(self, sql, args):
            calls.append(args)
            return type("R", (), {"rowcount": 1})()

    monkeypatch.setattr(work, "fail_run", lambda db, run, error, blocks=None: calls.append(("fail", blocks)))
    shard = {"id": "s", "runId": "r", "ordinal": 1, "sampleStart": 0, "sampleEnd": 5, "tries": 1}
    block = {"provider": "Meta", "kind": "account", "code": "user_blocked", "samples": 5}
    work.shard_failed(FakeDb(), shard, "me", work.Blocked("No sample was scored.", [block]))
    assert calls[0][0] == "failed" and calls[1] == ("fail", [block])
    calls.clear()
    work.shard_failed(FakeDb(), shard, "me", work.Blocked("x", [block | {"kind": "content"}]))
    assert calls == [("queued", "Blocked: x", False, "s", "me")]


def test_a_reply_that_the_provider_blocked_gets_no_retry():
    from inspect_ai.model._openai import OpenAIResponseError

    api = object.__new__(work.OpenRouterAPI)
    blocked = OpenAIResponseError("server_error", "Gemini blocked the response: OTHER")
    assert not work.OpenRouterAPI.should_retry(api, blocked)
    warming = OpenAIResponseError("server_error", "Model is warming up, please retry again after waiting for warmup.")
    assert work.OpenRouterAPI.should_retry(api, warming)


class Restarted(Exception):
    pass


def idle_loop(monkeypatch, steps: list[bool]) -> list[str]:
    """Runs `work` in one-run mode with stand-ins: `steps` are the results of `step`, then each
    wait is for room. Gives the restart reasons."""
    import contextlib

    reasons: list[str] = []

    def restart(name, why):
        reasons.append(why)
        raise Restarted

    monkeypatch.setattr(work, "Db", contextlib.nullcontext)
    monkeypatch.setattr(work, "open_bucket", lambda: None)
    monkeypatch.setattr(work, "step", lambda *a: steps.pop(0) if steps else False)
    monkeypatch.setattr(work, "waiting", lambda *a: (f"3 shards {work.ROOM_WAIT}", False))
    monkeypatch.setattr(work, "restart", restart)
    monkeypatch.setattr(work.time, "sleep", lambda s: None)
    with contextlib.suppress(Restarted):
        work.work(run_id="r", exit_when_idle=True)
    return reasons


def test_a_runner_that_ran_a_shard_starts_again_to_wait_for_room(monkeypatch):
    assert len(idle_loop(monkeypatch, [True])) == 1


def test_a_runner_that_ran_no_shard_waits_and_stops(monkeypatch):
    assert idle_loop(monkeypatch, []) == []
