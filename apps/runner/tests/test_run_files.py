"""A run's R2 files are deleted only when no database links them."""

import pytest

from openaudit_runner import run_files
from openaudit_runner.store import refuse_run_files

RUN = "01a0fbeb-0000-7000-8000-000000000001"
OTHER = "01a0fbeb-0000-7000-8000-000000000002"


class Bucket:
    def __init__(self, keys: list[str]) -> None:
        self.keys = keys

    def list_keys(self, prefix: str) -> list[str]:
        return [k for k in self.keys if k.startswith(prefix)]

    def delete_prefix(self, prefix: str, *, checked: bool = False) -> int:
        assert checked
        gone = self.list_keys(prefix)
        self.keys = [k for k in self.keys if k not in gone]
        return len(gone)


@pytest.fixture
def bucket() -> Bucket:
    return Bucket([f"runs/{RUN}/log.eval", f"runs/{RUN}/attempts/a.json", f"runs/{OTHER}/log.eval"])


def test_a_linked_run_keeps_its_files(bucket, monkeypatch):
    monkeypatch.setattr(run_files, "links", lambda dbs, r: {"dev": 0, "production": 3})
    assert run_files.delete_run_files(bucket, [RUN], apply=True, databases=[]) == 0
    assert len(bucket.keys) == 3


def test_a_run_that_no_database_links_loses_only_its_files(bucket, monkeypatch):
    monkeypatch.setattr(run_files, "links", lambda dbs, r: {"dev": 0, "production": 0})
    assert run_files.delete_run_files(bucket, [RUN], apply=False, databases=[]) == 2
    assert len(bucket.keys) == 3
    assert run_files.delete_run_files(bucket, [RUN], apply=True, databases=[]) == 2
    assert bucket.keys == [f"runs/{OTHER}/log.eval"]


def test_a_run_id_must_be_a_uuid(bucket):
    with pytest.raises(ValueError):
        run_files.delete_run_files(bucket, ["%"], apply=True, databases=[])


@pytest.mark.parametrize("prefix", [f"runs/{RUN}/", "runs/", "run", ""])
def test_a_plain_delete_refuses_run_files(prefix):
    with pytest.raises(ValueError, match="delete-run-files"):
        refuse_run_files(prefix)


def test_a_plain_delete_takes_other_prefixes():
    refuse_run_files("documents/x/")
