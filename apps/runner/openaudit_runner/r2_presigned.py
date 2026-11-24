"""R2 through pre-signed URLs, for runners with no R2 keys (Cloudflare Containers).

The runner Worker signs the URLs at `OPENAUDIT_R2_SIGN_URL` (`POST {runId, items: [{method,
key}]}` with `Authorization: Bearer $RUNNER_TOKEN`). It allows reads under `datasets/`,
`models/` and `runs/`, and writes only under `runs/<runId>/`.

`SignedBucket` has the methods of `store.Bucket` and of `hf_mirror.Reader`.
"""

import json
import os
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable, Iterable, Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any

import httpx

from .env import need
from .store import refuse_run_files

# The Worker gives URLs for 900 s. Use a URL for less time than that.
URL_SECONDS = 600
BATCH = 1000
TRIES = 4


class FileChunks:
    """A request body that reads the file again for each try."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def __iter__(self) -> Iterator[bytes]:
        with self.path.open("rb") as f:
            while chunk := f.read(1 << 20):
                yield chunk


class NoSuchKey(KeyError):
    pass


class SignError(RuntimeError):
    pass


class SignedBucket:
    def __init__(
        self,
        sign_url: str | None = None,
        token: str | None = None,
        run_id: str | None = None,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.sign_url = sign_url or need("OPENAUDIT_R2_SIGN_URL")
        self.token = token or need("RUNNER_TOKEN")
        self.run_id = run_id or os.environ.get("RUN_ID") or None
        self.http = httpx.Client(
            timeout=httpx.Timeout(120, connect=15),
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=32),
            # With compression on, R2 sends no Content-Length on HEAD, and ranges change.
            headers={"Accept-Encoding": "identity"},
            transport=transport,
        )
        self.urls: dict[tuple[str, str], tuple[str, float]] = {}
        self.lock = threading.Lock()

    def sign(self, items: list[tuple[str, str]]) -> list[str]:
        """Pre-signed URLs for (method, key) pairs, in the same order. One call per BATCH."""
        now = time.monotonic()
        with self.lock:
            cached = {i: self.urls.get(i) for i in items}
        todo = [i for i in dict.fromkeys(items) if not (c := cached[i]) or c[1] < now]
        for start in range(0, len(todo), BATCH):
            chunk = todo[start : start + BATCH]
            urls = self._sign([{"method": m, "key": k} for m, k in chunk])
            with self.lock:
                for item, url in zip(chunk, urls):
                    self.urls[item] = (url, now + URL_SECONDS)
        with self.lock:
            return [self.urls[i][0] for i in items]

    def _sign(self, items: list[dict[str, str]]) -> list[str]:
        body = {"items": items, **({"runId": self.run_id} if self.run_id else {})}
        for attempt in range(TRIES):
            try:
                r = self.http.post(
                    self.sign_url,
                    json=body,
                    headers={"Authorization": f"Bearer {self.token}"},
                )
            except httpx.TransportError:
                if attempt == TRIES - 1:
                    raise
                time.sleep(2**attempt)
                continue
            if r.status_code >= 500 and attempt < TRIES - 1:
                time.sleep(2**attempt)
                continue
            if r.status_code != 200:
                raise SignError(f"Sign {r.status_code}: {r.text[:300]}")
            return r.json()["urls"]
        raise AssertionError("unreachable")

    def forget(self, method: str, key: str) -> None:
        with self.lock:
            self.urls.pop((method, key), None)

    def request(
        self,
        method: str,
        key: str,
        url: str | None = None,
        make_url: Callable[[], str] | None = None,
        **kwargs: Any,
    ) -> httpx.Response:
        """Sends one request, with retries. Signs again when R2 refuses the URL (403)."""
        make_url = make_url or (lambda: self.sign([(method, key)])[0])
        for attempt in range(TRIES):
            url = url or make_url()
            try:
                r = self.http.request(method, url, **kwargs)
            except httpx.TransportError:
                if attempt == TRIES - 1:
                    raise
                time.sleep(2**attempt)
                continue
            if r.status_code == 403 and attempt == 0:
                self.forget(method, key)
                url = None
                continue
            if (r.status_code == 429 or r.status_code >= 500) and attempt < TRIES - 1:
                time.sleep(2**attempt)
                continue
            return r
        raise AssertionError("unreachable")

    @staticmethod
    def check(r: httpx.Response, method: str, key: str) -> httpx.Response:
        if r.status_code == 404:
            raise NoSuchKey(key)
        if r.status_code >= 300:
            raise RuntimeError(f"R2 {method} {key}: {r.status_code} {r.text[:300]}")
        return r

    # The methods of store.Bucket.

    def put(
        self, key: str, body: bytes, content_type: str, url: str | None = None
    ) -> None:
        r = self.request(
            "PUT", key, url, content=body, headers={"Content-Type": content_type}
        )
        self.check(r, "PUT", key)

    def put_file(self, key: str, path: Path, content_type: str) -> None:
        """Sends the file in chunks, so that a big log is never in memory. R2 takes up to 5 GB in
        one PUT."""
        headers = {
            "Content-Type": content_type,
            "Content-Length": str(path.stat().st_size),
        }
        r = self.request("PUT", key, content=FileChunks(path), headers=headers)
        self.check(r, "PUT", key)

    def get(self, key: str) -> bytes:
        return self.check(self.request("GET", key), "GET", key).content

    def put_json(self, key: str, value: Any, url: str | None = None) -> int:
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()
        self.put(key, body, "application/json", url)
        return len(body)

    def put_many_json(
        self, items: Iterable[tuple[str, Any]], workers: int = 16
    ) -> list[int]:
        items = list(items)
        urls = self.sign([("PUT", k) for k, _ in items])
        with ThreadPoolExecutor(workers) as pool:
            return list(
                pool.map(
                    lambda kv: self.put_json(kv[0][0], kv[0][1], kv[1]),
                    zip(items, urls),
                )
            )

    def list_keys(self, prefix: str) -> list[str]:
        keys: list[str] = []
        token: str | None = None
        while True:
            item = {
                "method": "LIST",
                "key": prefix,
                **({"token": token} if token else {}),
            }
            r = self.request("GET", prefix, make_url=lambda i=item: self._sign([i])[0])
            self.check(r, "LIST", prefix)
            root = ET.fromstring(r.content)
            keys += [e.text or "" for e in root.iterfind("{*}Contents/{*}Key")]
            token = root.findtext("{*}NextContinuationToken")
            if root.findtext("{*}IsTruncated") != "true" or not token:
                return keys

    def delete_prefix(self, prefix: str) -> int:
        refuse_run_files(prefix)
        keys = self.list_keys(prefix)
        if not keys:
            return 0
        urls = self.sign([("DELETE", k) for k in keys])
        with ThreadPoolExecutor(16) as pool:
            for k, r in zip(
                keys, pool.map(lambda ku: self.request("DELETE", *ku), zip(keys, urls))
            ):
                if r.status_code != 404:
                    self.check(r, "DELETE", k)
        return len(keys)

    # The methods of hf_mirror.Reader.

    def get_range(self, key: str, start: int, end: int) -> bytes:
        """Bytes `start` to `end` of the object. Both ends are included."""
        r = self.request("GET", key, headers={"Range": f"bytes={start}-{end}"})
        if r.status_code == 416:
            return b""
        body = self.check(r, "GET", key).content
        return body[start : end + 1] if r.status_code == 200 else body

    def size(self, key: str) -> int | None:
        r = self.request("HEAD", key)
        if r.status_code == 404:
            return None
        return int(self.check(r, "HEAD", key).headers["content-length"])

    def exists(self, key: str) -> bool:
        return self.size(key) is not None
