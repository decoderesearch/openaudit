import json
import re
import zipfile
from pathlib import Path
from typing import Any

import pytest

from openaudit_runner import redact

FIXTURE = Path(__file__).parents[3] / "spec" / "fixtures" / "hazard-levels.json"
CASES = json.loads(FIXTURE.read_text())["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["name"] for c in CASES])
def test_levels_match_the_site(case: dict[str, Any]) -> None:
    snippets = [{"category": c, "severity": s} for c, s in case["snippets"]]
    level = redact.attempt_hazard(case["own"], case.get("judged", redact.NO_SUMMARY), snippets)
    assert level == case["level"]
    assert redact.locked(level, case.get("display"), case.get("versionDisplay")) is case["locked"]


def write_log(path: Path) -> None:
    summaries = [{"id": "a", "epoch": 1}, {"id": "b", "epoch": 1}, {"id": "b", "epoch": 2}]
    reductions = [{"scorer": "s", "samples": [{"sample_id": "a", "value": 1}, {"sample_id": "b", "value": 0}]}]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("_journal/start.json", "{}")
        z.writestr("_journal/summaries/1.json", json.dumps(summaries))
        z.writestr("samples/a_epoch_1.json", '{"id": "a"}')
        z.writestr("samples/b_epoch_1.json", '{"id": "b", "output": "secret"}')
        z.writestr("samples/b_epoch_2.json", '{"id": "b"}')
        z.writestr("summaries.json", json.dumps(summaries))
        z.writestr("reductions.json", json.dumps(reductions))
        z.writestr("header.json", json.dumps({"eval": {"metadata": None}, "status": "success"}))
        z.writestr("other/notes.json", '{"output": "secret"}')


def test_redact_log_leaves_out_the_samples(tmp_path: Path) -> None:
    src, out = tmp_path / "log.eval", tmp_path / "out.eval"
    write_log(src)
    redact.redact_log(src, out, {("b", 1)})
    with zipfile.ZipFile(out) as z:
        assert sorted(z.namelist()) == [
            "_journal/start.json",
            "_journal/summaries/1.json",
            "header.json",
            "reductions.json",
            "samples/a_epoch_1.json",
            "samples/b_epoch_2.json",
            "summaries.json",
        ]
        keep = [{"id": "a", "epoch": 1}, {"id": "b", "epoch": 2}]
        assert json.loads(z.read("summaries.json")) == keep
        assert json.loads(z.read("_journal/summaries/1.json")) == keep
        # A reduction is over all epochs of a sample, so one hidden epoch hides it.
        assert json.loads(z.read("reductions.json"))[0]["samples"] == [{"sample_id": "a", "value": 1}]
        header = json.loads(z.read("header.json"))
        assert header["status"] == "success"
        assert header["eval"]["metadata"]["openaudit_redacted"]["omitted_samples"] == 1
        assert all(b"secret" not in z.read(n) for n in z.namelist())


def test_redact_log_fails_when_a_sample_has_no_file(tmp_path: Path) -> None:
    src = tmp_path / "log.eval"
    write_log(src)
    with pytest.raises(RuntimeError, match="No sample file"):
        redact.redact_log(src, tmp_path / "out.eval", {("c", 1)})


def test_redacted_key_is_the_signers_form() -> None:
    run = "0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b"
    key = redact.redacted_key(run, ["b", "a"])
    assert key == redact.redacted_key(run, ["a", "b"])
    assert re.fullmatch(rf"runs/{run}/redacted/[0-9a-f]{{16}}\.eval", key)


class Result:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows


class FakeDb:
    def __init__(self, run: dict[str, Any], attempts: list[dict[str, Any]], snippets: list[dict[str, Any]]) -> None:
        self.run, self.attempts, self.snippets = run, attempts, snippets
        self.updates: list[tuple[Any, ...]] = []

    def execute(self, query: str, params: Any = None) -> Result:
        if query.lstrip().startswith("UPDATE eval_run"):
            self.updates.append(params)
            return Result([])
        # The attempts query also names the other tables, in its EXISTS parts.
        if "FROM eval_attempt a" in query:
            return Result(self.attempts)
        if "FROM openaudit_snippet" in query:
            return Result(self.snippets)
        if "FROM reply_summary" in query:
            return Result([])
        if "FROM eval_run" in query:
            return Result([self.run])
        raise AssertionError(query)


class FakeBucket:
    def __init__(self, log: bytes) -> None:
        self.log = log
        self.puts: dict[str, bytes] = {}

    def get(self, key: str) -> bytes:
        assert key == "runs/r/log.eval"
        return self.log

    def put_file(self, key: str, path: Path, content_type: str) -> None:
        self.puts[key] = path.read_bytes()


RUN = {"id": "r", "logKey": "runs/r/log.eval", "logBytes": 10, "redactedKey": None, "redactedOmit": []}
ATTEMPTS = [
    {"id": "1", "runId": "r", "sampleId": "a", "epoch": 1, "hazard": "gated", "display": None, "version_display": None},
    {"id": "2", "runId": "r", "sampleId": "b", "epoch": 1, "hazard": None, "display": None, "version_display": None},
]
CHILD = [{"attemptId": "2", "category": "child_safety", "severity": "low"}]


def test_omitted_by_run() -> None:
    db = FakeDb(RUN, ATTEMPTS, CHILD)
    assert redact.omitted(db, ["r", "s"]) == {"r": [ATTEMPTS[1]], "s": []}  # type: ignore[arg-type]


def test_redact_run_with_nothing_to_leave_out_uses_the_log() -> None:
    db = FakeDb(RUN, ATTEMPTS, [])
    bucket = FakeBucket(b"")
    assert redact.redact_run(db, bucket, RUN, []) == "0 left out"  # type: ignore[arg-type]
    assert db.updates == [("runs/r/log.eval", 10, [], "r")]
    assert not bucket.puts


def test_redact_runs_writes_a_copy(tmp_path: Path) -> None:
    write_log(tmp_path / "log.eval")
    db = FakeDb(RUN, ATTEMPTS, CHILD)
    bucket = FakeBucket((tmp_path / "log.eval").read_bytes())
    assert redact.redact_runs(db, bucket) == {"made": 1, "same": 0, "failed": 0}  # type: ignore[arg-type]
    (key,) = bucket.puts
    assert key == redact.redacted_key("r", ["2"])
    assert db.updates[0][0] == key and db.updates[0][2] == ["2"]
    (tmp_path / "out.eval").write_bytes(bucket.puts[key])
    with zipfile.ZipFile(tmp_path / "out.eval") as z:
        assert "samples/b_epoch_1.json" not in z.namelist()


def test_redact_runs_counts_a_failure() -> None:
    db = FakeDb(RUN, ATTEMPTS, CHILD)
    bucket = FakeBucket(b"not a zip")
    assert redact.redact_runs(db, bucket) == {"made": 0, "same": 0, "failed": 1}  # type: ignore[arg-type]
    assert not db.updates and not bucket.puts


def test_redact_run_skips_a_current_copy() -> None:
    run = {**RUN, "redactedKey": "runs/r/log.eval", "redactedOmit": []}
    db = FakeDb(run, ATTEMPTS, [])
    assert redact.redact_run(db, FakeBucket(b""), run, []) == "same"  # type: ignore[arg-type]
    assert not db.updates
