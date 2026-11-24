"""Serves Hugging Face Hub repos from our R2 copy, on a local HTTP port.

R2 has each repo at a pinned commit: `datasets/hf/<repo>/<sha>/<path>` (models:
`models/hf/...`), with `<sha>/_manifest.json` = `{"source", "repo", "revision", "files":
[{"path", "bytes"}]}`. A file can also have `oid` (git blob id) and `sha256` (LFS).

Use:

    with mirror(BucketReader(), fresh_cache=True) as m:
        datasets.load_dataset(repo, revision=sha)
    m.served  # {(kind, repo, sha)} from R2
    m.misses  # requests sent to huggingface.co (or refused in strict mode)
"""

import hashlib
import json
import os
import re
import shutil
import sys
import tempfile
import threading
from collections import deque
from collections.abc import Iterator, MutableMapping
from concurrent.futures import Future, ThreadPoolExecutor
from contextlib import contextmanager
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import parse_qs, unquote, urlsplit

import httpx

ROOTS = {"dataset": "datasets/hf", "model": "models/hf"}
MANIFEST = "_manifest.json"
UPSTREAM = "https://huggingface.co"
CHUNK = 8 * 1024 * 1024
AHEAD = 8
SHA = re.compile(r"[0-9a-f]{40}")
REPO = r"[^/]+(?:/[^/]+)?"
API = re.compile(
    rf"/api/(models|datasets)/({REPO})/(revision|tree|paths-info)/([^/]+)(?:/(.*))?"
)
RESOLVE = re.compile(rf"/(datasets/)?({REPO})/resolve/([^/]+)/(.+)")
# huggingface_hub gets this list once a day for telemetry. It is not eval data, so it is not a miss.
HARNESSES = "/api/agent-harnesses"
# Response headers that apply to one hop only.
HOP = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade"}
# Fresh HF caches. On disk, not in /tmp: /tmp can be RAM (tmpfs), and a model cache is GBs.
CACHES = (
    Path(os.environ.get("OPENAUDIT_CACHE") or Path.home() / ".cache" / "openaudit") / "hf-tmp"
)


class Reader(Protocol):
    """Reads R2 objects by key. The mirror calls only these methods, from many threads."""

    def get(self, key: str) -> bytes:
        """Return all bytes of the object. Raise KeyError if there is no object."""
        ...

    def get_range(self, key: str, start: int, end: int) -> bytes:
        """Return bytes `start` to `end` of the object. Both ends are included."""
        ...

    def size(self, key: str) -> int | None:
        """Return the size in bytes, or None if there is no object."""
        ...


class BucketReader:
    """Reads R2 through `store.Bucket`. Needs the R2 keys."""

    def __init__(self, bucket: Any = None) -> None:
        if bucket is None:
            from .store import Bucket

            bucket = Bucket()
        self.bucket = bucket

    def get(self, key: str) -> bytes:
        try:
            return self.bucket.get(key)
        except self.bucket.s3.exceptions.NoSuchKey as e:
            raise KeyError(key) from e

    def get_range(self, key: str, start: int, end: int) -> bytes:
        r = self.bucket.s3.get_object(
            Bucket=self.bucket.name, Key=key, Range=f"bytes={start}-{end}"
        )
        return r["Body"].read()

    def size(self, key: str) -> int | None:
        from botocore.exceptions import ClientError

        try:
            r = self.bucket.s3.head_object(Bucket=self.bucket.name, Key=key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in (
                "404",
                "NoSuchKey",
                "NotFound",
            ):
                return None
            raise
        return r["ContentLength"]


def prefix(kind: str, repo: str, revision: str) -> str:
    return f"{ROOTS[kind]}/{repo}/{revision}"


@dataclass
class Snapshot:
    """One repo at one commit, from its manifest."""

    kind: str
    repo: str
    sha: str
    files: dict[str, dict[str, Any]]
    dirs: set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        for path in self.files:
            parts = path.split("/")[:-1]
            self.dirs.update("/".join(parts[: i + 1]) for i in range(len(parts)))

    def key(self, path: str) -> str:
        return f"{prefix(self.kind, self.repo, self.sha)}/{path}"

    def etag(self, path: str) -> str:
        f = self.files[path]
        return (
            f.get("sha256")
            or f.get("oid")
            or _hash(f"{self.repo}@{self.sha}/{path}:{f['bytes']}")
        )

    def entry(self, path: str) -> dict[str, Any]:
        if path in self.dirs:
            return {
                "type": "directory",
                "oid": _hash(f"{self.repo}@{self.sha}/{path}/"),
                "size": 0,
                "path": path,
            }
        f = self.files[path]
        entry = {
            "type": "file",
            "oid": f.get("oid") or self.etag(path),
            "size": f["bytes"],
            "path": path,
        }
        if f.get("sha256"):
            entry["lfs"] = {"oid": f["sha256"], "size": f["bytes"], "pointerSize": 134}
        return entry

    def tree(self, path: str, recursive: bool) -> list[dict[str, Any]] | None:
        if path and path not in self.dirs:
            return None
        base = f"{path}/" if path else ""
        names = [p for p in sorted(self.dirs | set(self.files)) if p.startswith(base)]
        if not recursive:
            names = [p for p in names if "/" not in p[len(base) :]]
        return [self.entry(p) for p in names]

    def info(self) -> dict[str, Any]:
        siblings = [
            {"rfilename": p, "size": f["bytes"], "blobId": self.entry(p)["oid"]}
            for p, f in sorted(self.files.items())
        ]
        info = {
            "id": self.repo,
            "sha": self.sha,
            "private": False,
            "gated": False,
            "disabled": False,
            "siblings": siblings,
        }
        if self.kind == "model":
            info["modelId"] = self.repo
        return info


def _hash(text: str) -> str:
    return hashlib.sha1(text.encode()).hexdigest()


def _chunks(reader: Reader, key: str, start: int, end: int) -> Iterator[bytes]:
    """Yield bytes `start` to `end` in order. Read up to AHEAD chunks at the same time."""
    spans = [(at, min(at + CHUNK, end + 1) - 1) for at in range(start, end + 1, CHUNK)]
    with ThreadPoolExecutor(AHEAD) as pool:
        pending: deque[Future[bytes]] = deque()
        for span in spans:
            pending.append(pool.submit(reader.get_range, key, *span))
            if len(pending) >= AHEAD:
                yield pending.popleft().result()
        while pending:
            yield pending.popleft().result()


def _range(header: str | None, size: int) -> tuple[int, int]:
    """Parse one `bytes=` range. Return (start, end), both included."""
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", (header or "").strip())
    if not m or m.group(1) == m.group(2) == "":
        raise ValueError(header)
    if m.group(1) == "":
        start, end = max(size - int(m.group(2)), 0), size - 1
    else:
        start = int(m.group(1))
        end = min(int(m.group(2)), size - 1) if m.group(2) else size - 1
    if start > end:
        raise ValueError(header)
    return start, end


class Mirror:
    """A local Hub server over a Reader. `strict` refuses what R2 does not have."""

    def __init__(
        self, reader: Reader, strict: bool = False, token: str | None = None
    ) -> None:
        self.reader = reader
        self.strict = strict
        self.token = token
        self.served: set[tuple[str, str, str]] = set()
        self.misses: list[dict[str, Any]] = []
        self.log: list[tuple[str, str, int, str]] = []
        self._snapshots: dict[tuple[str, str, str], Snapshot | None] = {}
        self._lock = threading.Lock()
        self._server: ThreadingHTTPServer | None = None
        self._client: httpx.Client | None = None
        self.url = ""

    def start(self) -> "Mirror":
        mirror = self

        class Handler(_Handler):
            owner = mirror

        self._server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._server.daemon_threads = True
        self.url = f"http://127.0.0.1:{self._server.server_address[1]}"
        threading.Thread(
            target=self._server.serve_forever, name="hf-mirror", daemon=True
        ).start()
        return self

    def stop(self) -> None:
        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None
        if self._client:
            self._client.close()
            self._client = None

    def snapshot(self, kind: str, repo: str, revision: str) -> Snapshot | None:
        if not SHA.fullmatch(revision):
            return None
        key = (kind, repo, revision)
        if key not in self._snapshots:
            try:
                manifest = json.loads(self.reader.get(f"{prefix(*key)}/{MANIFEST}"))
            except KeyError:
                manifest = None
            self._snapshots[key] = manifest and Snapshot(
                kind, repo, revision, {f["path"]: f for f in manifest["files"]}
            )
        return self._snapshots[key]

    def client(self) -> httpx.Client:
        with self._lock:
            if self._client is None:
                self._client = httpx.Client(
                    base_url=UPSTREAM, follow_redirects=False, timeout=60
                )
            return self._client

    def note(self, method: str, path: str, status: int, source: str) -> None:
        with self._lock:
            self.log.append((method, path, status, source))


class _Handler(BaseHTTPRequestHandler):
    owner: Mirror
    protocol_version = "HTTP/1.1"

    def log_message(self, format: str, *args: Any) -> None:
        pass

    def do_HEAD(self) -> None:
        self._route("HEAD")

    def do_GET(self) -> None:
        self._route("GET")

    def do_POST(self) -> None:
        self._route("POST")

    def _route(self, method: str) -> None:
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else b""
        url = urlsplit(self.path)
        try:
            if m := API.fullmatch(url.path):
                kind = m.group(1)[:-1]
                repo, op, revision = m.group(2), m.group(3), unquote(m.group(4))
                path = unquote(m.group(5) or "")
                snap = self.owner.snapshot(kind, repo, revision)
                if snap and not (op == "revision" and path):
                    return self._api(method, snap, op, path, parse_qs(url.query), body)
                return self._miss(method, kind, repo, revision, body)
            if m := RESOLVE.fullmatch(url.path):
                kind = "dataset" if m.group(1) else "model"
                repo, revision = m.group(2), unquote(m.group(3))
                if not (
                    kind == "model"
                    and repo.split("/")[0] in ("api", "spaces", "kernels", "buckets")
                ):
                    snap = self.owner.snapshot(kind, repo, revision)
                    if snap:
                        return self._file(method, snap, unquote(m.group(4)))
                    return self._miss(method, kind, repo, revision, body)
            if url.path == HARNESSES:
                return self._error(None, 404, "EntryNotFound", "Not in the R2 mirror")
            return self._miss(method, None, None, None, body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def _api(
        self, method: str, snap: Snapshot, op: str, path: str, query: dict, body: bytes
    ) -> None:
        if op == "revision":
            return self._json(snap, snap.info())
        if op == "tree":
            recursive = (query.get("recursive") or ["false"])[0].lower() == "true"
            entries = snap.tree(path, recursive)
            if entries is None:
                return self._error(
                    snap, 404, "EntryNotFound", f"{path} is not a folder"
                )
            return self._json(snap, entries)
        if self.headers.get_content_type() == "application/json":
            paths = json.loads(body or b"{}").get("paths") or []
        else:
            paths = parse_qs(body.decode()).get("paths") or []
        return self._json(
            snap, [snap.entry(p) for p in paths if p in snap.files or p in snap.dirs]
        )

    def _file(self, method: str, snap: Snapshot, path: str) -> None:
        if path not in snap.files:
            return self._error(
                snap, 404, "EntryNotFound", f"{path} is not in {snap.repo}@{snap.sha}"
            )
        size = snap.files[path]["bytes"]
        start, end, status = 0, size - 1, 200
        if self.headers.get("Range"):
            try:
                start, end = _range(self.headers["Range"], size)
                status = 206
            except ValueError:
                self.send_response(416)
                self.send_header("Content-Range", f"bytes */{size}")
                self.send_header("Content-Length", "0")
                self.end_headers()
                return self.owner.note(method, self.path, 416, "r2")
        self.send_response(status)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("ETag", f'"{snap.etag(path)}"')
        self.send_header("X-Repo-Commit", snap.sha)
        if status == 206:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.end_headers()
        self._served(snap, method, status)
        if method == "HEAD" or size == 0:
            return
        key = snap.key(path)
        if status == 200 and size <= CHUNK:
            self.wfile.write(self.owner.reader.get(key))
            return
        for data in _chunks(self.owner.reader, key, start, end):
            self.wfile.write(data)

    def _json(self, snap: Snapshot, value: Any) -> None:
        data = json.dumps(value).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Repo-Commit", snap.sha)
        self.end_headers()
        self.wfile.write(data)
        self._served(snap, self.command, 200)

    def _error(
        self, snap: Snapshot | None, status: int, code: str, message: str
    ) -> None:
        self.send_response(status)
        self.send_header("X-Error-Code", code)
        self.send_header("X-Error-Message", message)
        if snap:
            self.send_header("X-Repo-Commit", snap.sha)
        self.send_header("Content-Type", "application/json")
        data = json.dumps({"error": message}).encode()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)
        self.owner.note(self.command, self.path, status, "r2" if snap else "refused")

    def _served(self, snap: Snapshot, method: str, status: int) -> None:
        with self.owner._lock:
            self.owner.served.add((snap.kind, snap.repo, snap.sha))
        self.owner.note(method, self.path, status, "r2")

    def _miss(
        self,
        method: str,
        kind: str | None,
        repo: str | None,
        revision: str | None,
        body: bytes,
    ) -> None:
        with self.owner._lock:
            self.owner.misses.append(
                {
                    "method": method,
                    "path": self.path,
                    "kind": kind,
                    "repo": repo,
                    "revision": revision,
                }
            )
        if self.owner.strict:
            code = "RepoNotFound" if repo else "EntryNotFound"
            where = f"{kind} {repo}@{revision}" if repo else self.path
            return self._error(
                None, 404, code, f"{where} is not in the R2 mirror (strict mode)"
            )
        self._pass(method, body)

    def _pass(self, method: str, body: bytes) -> None:
        """Send the request to huggingface.co and copy back the answer."""
        headers = {
            k: v
            for k, v in self.headers.items()
            if k.lower()
            not in ("host", "connection", "content-length", "accept-encoding")
        }
        headers["Accept-Encoding"] = "identity"
        token = self.owner.token or os.environ.get("HF_TOKEN")
        if token and not any(k.lower() == "authorization" for k in headers):
            headers["Authorization"] = f"Bearer {token}"
        with self.owner.client().stream(
            method, self.path, headers=headers, content=body or None
        ) as r:
            data = (
                None
                if method == "HEAD" or "content-length" in r.headers
                else b"".join(r.iter_raw())
            )
            self.send_response(r.status_code)
            for k, v in r.headers.multi_items():
                if k.lower() not in HOP and not (
                    data is not None and k.lower() == "content-length"
                ):
                    self.send_header(k, v)
            if data is not None:
                self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.owner.note(method, self.path, r.status_code, "hf")
            if method == "HEAD":
                return
            if data is not None:
                self.wfile.write(data)
                return
            for chunk in r.iter_raw(CHUNK):
                self.wfile.write(chunk)


def _point(url: str, cache: Path | None) -> list[tuple[Any, str, Any]]:
    """Point huggingface_hub and datasets at `url` and `cache`. Return what to restore."""
    import huggingface_hub
    from huggingface_hub import HfFileSystem, constants, hf_api

    old: list[tuple[Any, str, Any]] = []

    def put(target: Any, name: str, value: Any) -> None:
        if isinstance(target, MutableMapping):
            old.append((target, name, target.get(name)))
            if value is None:
                target.pop(name, None)
            else:
                target[name] = value
        else:
            old.append((target, name, getattr(target, name)))
            setattr(target, name, value)

    template = url + "/{repo_id}/resolve/{revision}/{filename}"
    put(os.environ, "HF_ENDPOINT", url)
    put(constants, "ENDPOINT", url)
    put(constants, "HUGGINGFACE_CO_URL_TEMPLATE", template)
    if "HUGGINGFACE_CO_URL_TEMPLATE" in vars(huggingface_hub):
        put(huggingface_hub, "HUGGINGFACE_CO_URL_TEMPLATE", template)
    put(hf_api.api, "endpoint", url)
    try:
        import datasets.config as dconfig
    except ImportError:
        dconfig = None
    if dconfig:
        put(dconfig, "HF_ENDPOINT", url)
        put(
            dconfig,
            "HUB_DATASETS_URL",
            url + "/datasets/{repo_id}/resolve/{revision}/{path}",
        )
    if cache:
        hub, ds = str(cache / "hub"), cache / "datasets"
        for name, value in (
            ("HF_HUB_CACHE", hub),
            ("HF_DATASETS_CACHE", str(ds)),
            ("HF_XET_CACHE", str(cache / "xet")),
        ):
            put(os.environ, name, value)
        for name in ("HF_HUB_CACHE", "HUGGINGFACE_HUB_CACHE"):
            put(constants, name, hub)
        put(constants, "HF_ASSETS_CACHE", str(cache / "assets"))
        put(constants, "HF_XET_CACHE", str(cache / "xet"))
        if dconfig:
            put(dconfig, "HF_DATASETS_CACHE", ds)
            put(
                dconfig,
                "DOWNLOADED_DATASETS_PATH",
                ds / dconfig.DOWNLOADED_DATASETS_DIR,
            )
            put(
                dconfig,
                "EXTRACTED_DATASETS_PATH",
                ds / dconfig.DOWNLOADED_DATASETS_DIR / dconfig.EXTRACTED_DATASETS_DIR,
            )
    # fsspec keeps HfFileSystem objects, and each one keeps its endpoint.
    HfFileSystem.clear_instance_cache()
    return old


def _restore(old: list[tuple[Any, str, Any]]) -> None:
    for target, name, value in reversed(old):
        if isinstance(target, MutableMapping):
            if value is None:
                target.pop(name, None)
            else:
                target[name] = value
        else:
            setattr(target, name, value)
    if "huggingface_hub" in sys.modules:
        from huggingface_hub import HfFileSystem

        HfFileSystem.clear_instance_cache()


def remove_dead_caches(root: Path | None = None) -> None:
    """Removes the fresh caches (`oa-hf-<pid>-*`) of processes that are gone. A killed process
    cannot remove its own."""
    root = root or CACHES
    if not root.is_dir():
        return
    for d in root.glob("oa-hf-*-*"):
        pid = d.name.split("-")[2]
        if not pid.isdigit() or int(pid) == os.getpid():
            continue
        try:
            os.kill(int(pid), 0)
        except ProcessLookupError:
            shutil.rmtree(d, ignore_errors=True)
        except PermissionError:
            pass


@contextmanager
def mirror(
    reader: Reader,
    strict: bool = False,
    fresh_cache: bool = False,
    token: str | None = None,
) -> Iterator[Mirror]:
    """Serve the Hub from `reader` while the block runs, in this process and its children.

    `strict` gives 404 for all that R2 does not have. If not strict, the request goes to
    huggingface.co with `token` (default: HF_TOKEN). `fresh_cache` uses an empty temp HF cache.
    """
    m = Mirror(reader, strict=strict, token=token).start()
    cache = None
    if fresh_cache:
        remove_dead_caches()
        CACHES.mkdir(parents=True, exist_ok=True)
        cache = Path(tempfile.mkdtemp(prefix=f"oa-hf-{os.getpid()}-", dir=CACHES))
    old = _point(m.url, cache)
    try:
        yield m
    finally:
        _restore(old)
        m.stop()
        if cache:
            shutil.rmtree(cache, ignore_errors=True)
