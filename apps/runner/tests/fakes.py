"""A fake connection and bucket that keep what an import writes. No database and no R2."""

import contextlib
import json
from typing import Any, Self


class Result:
    def __init__(self, rows: list[dict[str, Any]], rowcount: int = 0) -> None:
        self.rows, self.rowcount = rows, rowcount

    def fetchone(self) -> dict[str, Any] | None:
        return self.rows[0] if self.rows else None

    def fetchall(self) -> list[dict[str, Any]]:
        return self.rows

    def __iter__(self):
        return iter(self.rows)


class Cursor:
    def __init__(self, conn: "FakeConn") -> None:
        self.conn = conn

    def executemany(self, query: str, rows: Any) -> None:
        if query.lstrip().startswith("UPDATE eval_sample"):
            for run_id, settings, sid in rows:
                self.conn.sample_settings.setdefault(sid, {})[run_id] = settings.obj
            return
        if "INTO eval_sample" in query:
            for id, version, split, sid, sha in rows:
                self.conn.samples.setdefault((version, split, sid), (id, sha))
            return
        table = "eval_attempt" if "INTO eval_attempt" in query else "eval_result"
        for row in rows:
            self.conn.inserted(table, row)

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        pass


class FakeConn:
    """`keep=False` counts the rows and drops them, for memory tests."""

    def __init__(
        self, run: dict[str, Any], old: list[dict[str, Any]], keep: bool = True
    ) -> None:
        self.run, self.old, self.keep = run, old, keep
        self.rows: dict[str, list[Any]] = {"eval_attempt": [], "eval_result": []}
        self.counts = {"eval_attempt": 0, "eval_result": 0}
        # (version, split, source id): (id, sha256).
        self.samples: dict[tuple[str, str, str], tuple[str, str]] = {}
        self.update: Any = None
        # The versions whose sample fail counts were set again.
        self.refreshed: list[str] = []
        # By sample id, by run id: the settings that the import set in the sample's metadata.
        self.sample_settings: dict[str, dict[str, Any]] = {}

    def inserted(self, table: str, row: Any) -> None:
        self.counts[table] += 1
        if self.keep:
            self.rows[table].append(row)

    def execute(self, query: str, params: Any = None) -> Result:
        if '"logSha256" = %s' in query and query.lstrip().startswith("SELECT"):
            return Result([])
        if query.startswith("SELECT * FROM eval_run"):
            return Result([self.run])
        if "JOIN eval_version v" in query:
            return Result(
                [
                    {
                        "id": params[0],
                        "route": self.run.get("route") or {"kind": "direct", "model": "m"},
                        "settings": self.run.get("settings") or {},
                        "origin": "import",
                        "sourceRunId": None,
                        "provenance": {},
                        "slug": "eval",
                        "eval_name": "Eval",
                        "version": "1",
                        "runner": {},
                        "metrics": [{"key": "accuracy", "displayName": "Accuracy", "description": "Long."}],
                        "model": "m",
                    }
                ]
            )
        if "FROM eval_version" in query:
            dataset = {"splits": [{"name": "test", "sampleCount": 6, "storage": "pointer"}]}
            return Result([{"runner": {}, "sampleTerms": None, "metrics": None, "dataset": dataset}])
        if "FROM eval_sample" in query:
            version, sids = params
            return Result(
                [
                    {"id": id, "split": split, "sourceId": sid}
                    for (v, split, sid), (id, _) in self.samples.items()
                    if v == version and sid in sids
                ]
            )
        if "FROM eval_attempt" in query and query.startswith("SELECT"):
            return Result(self.old)
        if "mode()" in query:
            return Result([{"c": None}])
        if '"displayName"' in query:
            return Result([{"displayName": "Eval", "slug": "eval"}])
        if query.startswith("DELETE"):
            return Result([], 0)
        if query.lstrip().startswith("UPDATE eval_run"):
            self.update = params
            return Result([], 1)
        if "to_regprocedure('refresh_sample_stats(uuid)')" in query:
            return Result([{"ok": True}])
        if "SELECT refresh_sample_stats(" in query:
            self.refreshed.append(params[0])
            return Result([{"n": 0}])
        raise AssertionError(f"Unexpected query: {query[:80]}")

    def transaction(self) -> contextlib.AbstractContextManager[None]:
        return contextlib.nullcontext()

    def cursor(self) -> Cursor:
        return Cursor(self)


class FakeBucket:
    def __init__(self, keep: bool = True) -> None:
        self.keep = keep
        self.bodies: dict[str, Any] = {}
        self.files: dict[str, int] = {}

    def put_file(self, key: str, path: Any, content_type: str) -> None:
        self.files[key] = path.stat().st_size

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.files[key] = len(body)

    def put_json(self, key: str, value: Any) -> int:
        return self.put_many_json([(key, value)])[0]

    def get_or_none(self, key: str) -> bytes | None:
        return json.dumps(self.bodies[key]).encode() if key in self.bodies else None

    def has_prefix(self, prefix: str) -> bool:
        return any(k.startswith(prefix) for k in [*self.bodies, *self.files])

    def put_many_json(self, items: Any) -> list[int]:
        sizes = []
        for key, value in items:
            body = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
            sizes.append(len(body.encode()))
            if self.keep:
                self.bodies[key] = value
        return sizes
