"""The R2 Hub mirror, with an in-memory reader. No network."""

import io
import json
import os
import socket
import subprocess
import sys
from pathlib import Path

import datasets
import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from huggingface_hub import HfFileSystem, constants, hf_hub_download, snapshot_download
from huggingface_hub.errors import RepositoryNotFoundError

from openaudit_runner import hf_mirror
from openaudit_runner.hf_mirror import mirror, prefix

DS, DS_SHA = "acme/tiny", "a" * 40
MODEL, MODEL_SHA = "acme/tiny-model", "b" * 40

PQ, PQ_SHA = "acme/tiny-pq", "d" * 40

README = """---
configs:
- config_name: csv
  data_files:
  - split: train
    path: csv/train.csv
---
# Tiny
"""


def parquet() -> bytes:
    out = io.BytesIO()
    pq.write_table(pa.table({"q": ["x", "y", "z"], "n": [1, 2, 3]}), out)
    return out.getvalue()


class MemoryReader:
    def __init__(self) -> None:
        self.objects: dict[str, bytes] = {}

    def add(self, kind: str, repo: str, sha: str, files: dict[str, bytes]) -> None:
        base = prefix(kind, repo, sha)
        for path, body in files.items():
            self.objects[f"{base}/{path}"] = body
        manifest = {
            "repo": repo,
            "revision": sha,
            "files": [{"path": p, "bytes": len(b)} for p, b in files.items()],
        }
        self.objects[f"{base}/{hf_mirror.MANIFEST}"] = json.dumps(manifest).encode()

    def get(self, key: str) -> bytes:
        return self.objects[key]

    def get_range(self, key: str, start: int, end: int) -> bytes:
        return self.objects[key][start : end + 1]

    def size(self, key: str) -> int | None:
        return len(self.objects[key]) if key in self.objects else None


@pytest.fixture
def reader() -> MemoryReader:
    r = MemoryReader()
    r.add(
        "dataset",
        DS,
        DS_SHA,
        {
            "README.md": README.encode(),
            "csv/train.csv": b"q,n\nhello,1\nworld,2\n",
        },
    )
    r.add("dataset", PQ, PQ_SHA, {"data/test-00000-of-00001.parquet": parquet()})
    r.add(
        "model",
        MODEL,
        MODEL_SHA,
        {
            "config.json": json.dumps(
                {"model_type": "bert", "hidden_size": 8}
            ).encode(),
            "big.bin": bytes(range(256)) * 100,
        },
    )
    return r


@pytest.fixture(autouse=True)
def no_network(monkeypatch):
    connect = socket.socket.connect

    def local_only(self, address):
        if self.family in (socket.AF_INET, socket.AF_INET6) and address[0] not in (
            "127.0.0.1",
            "::1",
            "localhost",
        ):
            raise OSError(f"Network use in a test: {address}")
        return connect(self, address)

    monkeypatch.setattr(socket.socket, "connect", local_only)


def test_hf_hub_download_and_snapshot(reader):
    with mirror(reader, strict=True, fresh_cache=True) as m:
        path = hf_hub_download(
            DS, "csv/train.csv", repo_type="dataset", revision=DS_SHA
        )
        assert (
            Path(path).read_bytes()
            == reader.objects[f"{prefix('dataset', DS, DS_SHA)}/csv/train.csv"]
        )
        local = snapshot_download(MODEL, revision=MODEL_SHA)
        assert json.loads(Path(f"{local}/config.json").read_text())["hidden_size"] == 8
        assert Path(f"{local}/big.bin").read_bytes() == bytes(range(256)) * 100
    assert m.misses == []
    assert m.served == {("dataset", DS, DS_SHA), ("model", MODEL, MODEL_SHA)}


def test_range_reads(reader, monkeypatch):
    monkeypatch.setattr(hf_mirror, "CHUNK", 1000)
    with mirror(reader, strict=True, fresh_cache=True) as m:
        with HfFileSystem().open(
            f"{MODEL}@{MODEL_SHA}/big.bin", "rb", block_size=64
        ) as f:
            f.seek(300)
            assert f.read(10) == bytes(range(44, 54))
        local = hf_hub_download(MODEL, "big.bin", revision=MODEL_SHA)
        assert Path(local).read_bytes() == bytes(range(256)) * 100
    assert any(status == 206 for _, _, status, _ in m.log)
    assert hf_mirror._range("bytes=-5", 20) == (15, 19)
    assert hf_mirror._range("bytes=10-", 20) == (10, 19)
    with pytest.raises(ValueError):
        hf_mirror._range("bytes=30-40", 20)


def test_load_dataset(reader):
    with mirror(reader, strict=True, fresh_cache=True) as m:
        train = datasets.load_dataset(DS, "csv", split="train", revision=DS_SHA)
        test = datasets.load_dataset(PQ, split="test", revision=PQ_SHA)
    assert train["q"] == ["hello", "world"]
    assert test["n"] == [1, 2, 3]
    assert m.misses == []
    assert m.served == {("dataset", DS, DS_SHA), ("dataset", PQ, PQ_SHA)}


def test_transformers_config(reader):
    transformers = pytest.importorskip("transformers")
    with mirror(reader, strict=True, fresh_cache=True) as m:
        config = transformers.AutoConfig.from_pretrained(MODEL, revision=MODEL_SHA)
    assert config.hidden_size == 8
    assert ("model", MODEL, MODEL_SHA) in m.served


def test_miss_goes_to_the_hub(reader):
    seen = []

    def hub(request):
        seen.append(
            (request.method, request.url.path, request.headers["authorization"])
        )
        body = json.dumps({"sha": "e" * 40}).encode()
        return httpx.Response(
            200,
            headers={"content-length": str(len(body))},
            stream=httpx.ByteStream(body),
        )

    with mirror(reader, token="tok") as m:
        m._client = httpx.Client(base_url=m.url, transport=httpx.MockTransport(hub))
        path = f"/api/datasets/{DS}/revision/main"
        assert httpx.get(m.url + path).json() == {"sha": "e" * 40}
        assert httpx.head(m.url + path).status_code == 200
    assert seen == [("GET", path, "Bearer tok"), ("HEAD", path, "Bearer tok")]
    assert [(x["method"], x["revision"]) for x in m.misses] == [
        ("GET", "main"),
        ("HEAD", "main"),
    ]


def test_strict_miss_is_an_error(reader):
    before = constants.ENDPOINT
    with mirror(reader, strict=True, fresh_cache=True) as m:
        assert constants.ENDPOINT == m.url
        with pytest.raises(RepositoryNotFoundError):
            hf_hub_download(DS, "csv/train.csv", repo_type="dataset", revision="main")
        with pytest.raises(datasets.exceptions.DatasetNotFoundError):
            datasets.load_dataset(DS, "csv", split="train", revision="c" * 40)
    assert {(x["repo"], x["revision"]) for x in m.misses} == {
        (DS, "main"),
        (DS, "c" * 40),
    }
    assert constants.ENDPOINT == before
    assert datasets.config.HF_ENDPOINT.rstrip("/") == before


def test_remove_dead_caches(tmp_path, monkeypatch, reader):
    gone = subprocess.run([sys.executable, "-c", "import os; print(os.getpid())"], capture_output=True, text=True, check=True)
    dead = tmp_path / f"oa-hf-{gone.stdout.strip()}-abc"
    live = tmp_path / f"oa-hf-{os.getpid()}-def"
    old = tmp_path / "oa-hf-nopid"
    for d in (dead, live, old):
        (d / "hub").mkdir(parents=True)
    hf_mirror.remove_dead_caches(tmp_path)
    assert not dead.exists() and live.exists() and old.exists()
    monkeypatch.setattr(hf_mirror, "CACHES", tmp_path / "caches")
    with mirror(reader, fresh_cache=True):
        made = list((tmp_path / "caches").iterdir())
        assert [d.name.split("-")[2] for d in made] == [str(os.getpid())]
    assert not made[0].exists()
