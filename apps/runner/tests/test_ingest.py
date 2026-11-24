"""The import reads samples one at a time. Inspect's mock model and a fake database and bucket."""

from pathlib import Path

import pytest
from fakes import FakeBucket, FakeConn
from inspect_ai import Epochs, Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.log import read_eval_log, write_eval_log
from inspect_ai.model import ModelCall
from inspect_ai.scorer import includes
from inspect_ai.solver import generate
from test_work import PAD, big_shard, grows_less_than_samples, peak_bytes

from openaudit_runner import ingest
from openaudit_runner import inspect_map as im


def uid(n: int) -> str:
    return f"01a0fbeb-0000-7000-8000-{n:012x}"


RUN = {
    "evalId": uid(1),
    "evalVersionId": uid(2),
    "modelId": uid(3),
    "origin": "run",
    "route": {"kind": "openrouter", "model": "x"},
    "settings": {},
    "provenance": {},
}


def mock_log(tmp_path, n: int = 6):
    task = Task(
        dataset=MemoryDataset(
            [Sample(id=f"s{i}", input=f"Q{i}", target="Default") for i in range(n)]
        ),
        solver=generate(),
        scorer=includes(),
        epochs=Epochs(2, "mean"),
    )
    [log] = inspect_eval(
        task, model="mockllm/model", log_dir=str(tmp_path), display="none"
    )
    return log


def import_fake(path: Path, keep: bool = True) -> tuple[FakeConn, FakeBucket]:
    conn, bucket = FakeConn(RUN, [], keep), FakeBucket(keep)
    ingest.import_log(conn, bucket, path, run_id=uid(9))
    return conn, bucket


def plain(row: dict) -> dict:
    return {k: getattr(v, "obj", v) for k, v in row.items()}


def test_import_rows_are_the_attempts_of_the_whole_log_in_order(tmp_path):
    log = mock_log(tmp_path)
    path = Path(log.location)
    conn, bucket = import_fake(path)
    whole = read_eval_log(str(path))
    headline = im.headline_scorer(whole)
    want = [
        im.attempt(s, o, headline, whole.eval.model)
        for o, s in im.ordinals(whole, whole.samples)
    ]
    got = [plain(a) for a in conn.rows["eval_attempt"]]
    keys = want[0].keys()
    assert [{k: a[k] for k in keys} for a in got] == want
    assert len(got) == 12 and [a["ordinal"] for a in got] == list(range(1, 13))
    assert len(bucket.bodies) == 12 and all(a["bodyBytes"] > 0 for a in got)
    log_key = f"runs/{uid(9)}/log-{ingest.sha256(path)[:16]}.eval"
    assert bucket.files == {log_key: path.stat().st_size}
    assert all(
        a["bodyKey"] == ingest.body_key(f"runs/{uid(9)}/", a["id"], bucket.bodies[a["bodyKey"]])
        for a in got
    )
    status, _, provenance, *_rest, sample_count, attempt_count, _ = conn.update
    assert (status, sample_count, attempt_count) == ("succeeded", 12, 12)
    assert provenance.obj["tokens"] == {
        k: sum(a["tokens"][k] for a in got) for k in ("input", "output", "reasoning")
    }
    assert conn.counts["eval_result"] == len(im.results(whole))


def test_import_adds_each_sample_once_and_links_its_attempts(tmp_path):
    conn, _ = import_fake(Path(mock_log(tmp_path, 3).location))
    assert sorted(sid for _, _, sid in conn.samples) == ["s0", "s1", "s2"]
    ids = {sid: id for (_, _, sid), (id, _) in conn.samples.items()}
    got = [(a["sampleId"], a["evalSampleId"]) for a in conn.rows["eval_attempt"]]
    assert got == [(a, ids[a]) for a in ("s0", "s0", "s1", "s1", "s2", "s2")]
    assert conn.refreshed == [next(iter(conn.samples))[0]]


def test_a_json_log_is_imported_too(tmp_path):
    log = mock_log(tmp_path, 3)
    path = tmp_path / "log.json"
    write_eval_log(read_eval_log(log.location), str(path))
    conn, _ = import_fake(path)
    assert [a["sampleId"] for a in conn.rows["eval_attempt"]] == [
        "s0",
        "s0",
        "s1",
        "s1",
        "s2",
        "s2",
    ]


def test_the_log_note_goes_to_the_provenance(tmp_path):
    log = read_eval_log(mock_log(tmp_path, 1).location)
    log.eval.metadata = {"note": "Graded again by another judge."}
    path = tmp_path / "noted.eval"
    write_eval_log(log, str(path))
    conn, _ = import_fake(path)
    _, _, provenance, *_ = conn.update
    assert provenance.obj["note"] == "Graded again by another judge."


def test_each_attempt_and_sample_keeps_the_run_settings_and_its_own(tmp_path):
    log = read_eval_log(mock_log(tmp_path, 2).location)
    own = {"judge": {"model": "j", "name": "J"}}
    for s in log.samples:
        if s.id == "s0":
            s.metadata = {"openauditSettings": own}
    path = tmp_path / "own.eval"
    write_eval_log(log, str(path))
    conn, _ = import_fake(path)
    got = {a["sampleId"]: plain(a)["settings"] for a in conn.rows["eval_attempt"]}
    first = got["s0"]
    assert first["runId"] == uid(9) and first["eval"]["slug"] == "eval"
    assert first["task"] == log.eval.task and first["harness"]["tool"] == "inspect_ai"
    assert first["metrics"] == [{"key": "accuracy", "displayName": "Accuracy"}]
    assert first["sample"] == own and "sample" not in got["s1"]
    by_sample = {a["evalSampleId"]: plain(a)["settings"] for a in conn.rows["eval_attempt"]}
    assert {sid: s[uid(9)] for sid, s in conn.sample_settings.items()} == by_sample


def test_import_memory_does_not_grow_with_the_samples(tmp_path):
    base = read_eval_log(mock_log(tmp_path / "base").location)
    base.eval.config.epochs = 1

    def peak(n: int) -> int:
        path = big_shard(tmp_path / f"{n}.eval", base, range(n), PAD, reductions=True)
        return peak_bytes(lambda: import_fake(path, keep=False))

    grows_less_than_samples(peak, 100, 1000)


def test_transcript_counts_the_calls_of_each_provider(tmp_path):
    sample = read_eval_log(mock_log(tmp_path, 1).location).samples[0]
    [event] = [e for e in sample.events if e.event == "model"]
    assert im.served_by(sample) == {"mockllm/model": {"unknown": 1}}
    event.call = ModelCall(request={}, response={"provider": "Alibaba"})
    sample.events.append(event.model_copy(update={"error": "429"}))
    body = im.transcript(sample, uid(5), uid(3), "mockllm/model")
    assert body["extensions"]["inspect"]["servedBy"] == {
        "mockllm/model": {"Alibaba": 1}
    }


def test_a_changed_transcript_gets_a_new_key():
    a = ingest.body_key("runs/r/", uid(5), {"x": 1})
    assert a == ingest.body_key("runs/r/", uid(5), {"x": 1})
    assert a != ingest.body_key("runs/r/", uid(5), {"x": 2})
    assert a.startswith(f"runs/r/attempts/{uid(5)}-")


def test_a_log_that_another_database_has_is_not_imported_again():
    bucket = FakeBucket()
    ingest.refuse_other_import(bucket, "abc")
    bucket.put_json(ingest.claim_key("abc"), {"runId": uid(7)})
    # The claim's run has no files: it was deleted, so a new import is fine.
    ingest.refuse_other_import(bucket, "abc")
    bucket.files[f"runs/{uid(7)}/log-x.eval"] = 1
    with pytest.raises(SystemExit, match="/admin/sync"):
        ingest.refuse_other_import(bucket, "abc")


def test_alive_connects_again_when_the_server_closed_the_connection(monkeypatch):
    import psycopg

    class Closed:
        def execute(self, sql):
            raise psycopg.OperationalError("SSL connection has been closed unexpectedly")

    class Open:
        def execute(self, sql):
            return None

    fresh = Open()
    monkeypatch.setattr(ingest, "connect", lambda: fresh)
    kept = Open()
    assert ingest.alive(kept) is kept
    assert ingest.alive(Closed()) is fresh
