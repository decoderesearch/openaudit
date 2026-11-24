"""The database and the private R2 bucket."""

import contextlib
import json
import os
import time
from collections.abc import Callable, Iterable
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Self, TypeVar

import boto3
import certifi
import psycopg
from botocore.config import Config
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .env import need

T = TypeVar("T")


def connect(url: str | None = None) -> psycopg.Connection:
    # Neon asks for `sslmode=verify-full`. The libpq in psycopg's wheel cannot find the OS roots.
    os.environ.setdefault("PGSSLROOTCERT", certifi.where())
    return psycopg.connect(url or need("DATABASE_URL"), row_factory=dict_row, autocommit=True)


class Db:
    """A connection that opens again when the server closes it (Neon closes idle ones).
    Use one in each thread."""

    def __init__(self) -> None:
        self.conn: psycopg.Connection | None = None

    def call(self, fn: Callable[[psycopg.Connection], T]) -> T:
        """Runs `fn` on the connection. When the connection is lost, connects again and runs
        `fn` again, with a backoff. `fn` must be safe to run twice."""
        delay = 1.0
        replanned = False
        while True:
            try:
                if self.conn is None or self.conn.closed:
                    self.conn = connect()
                return fn(self.conn)
            except psycopg.errors.FeatureNotSupported as e:
                # A migration changed a table under a prepared `SELECT *`; a new connection has no old plans.
                if replanned or "cached plan must not change result type" not in str(e):
                    raise
                replanned = True
                print("Database: a table changed under a prepared statement. Connecting again.", flush=True)
                self.close()
            except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                # A timeout or deadlock is an OperationalError on a good connection.
                if (
                    self.conn is not None
                    and not self.conn.broken
                    and not self.conn.closed
                ):
                    raise
                first = str(e).strip().splitlines()[0][:200] if str(e).strip() else ""
                print(
                    f"Database: {type(e).__name__}: {first} Connecting again in {delay:.0f} s.",
                    flush=True,
                )
                self.close()
                time.sleep(delay)
                delay = min(delay * 2, 60)

    def execute(self, query: Any, params: Any = None) -> psycopg.Cursor:
        return self.call(lambda conn: conn.execute(query, params))

    def close(self) -> None:
        if self.conn is not None:
            with contextlib.suppress(Exception):
                self.conn.close()
            self.conn = None

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()


def jsonb(value: Any) -> Jsonb:
    return Jsonb(value)


def json_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def refuse_run_files(prefix: str) -> None:
    """Dev and production share the bucket and the run ids, so a run's files can be production's."""
    if prefix.startswith("runs/") or "runs/".startswith(prefix):
        raise ValueError(
            f"Will not delete {prefix!r}: production can link run files. "
            "Use `openaudit-runner delete-run-files`, which checks each database first."
        )


def open_bucket() -> Any:
    """The bucket for this runner: pre-signed URLs when `OPENAUDIT_R2_SIGN_URL` is set (a
    container with no R2 keys), else R2 keys."""
    if os.environ.get("OPENAUDIT_R2_SIGN_URL"):
        from .r2_presigned import SignedBucket

        return SignedBucket()
    return Bucket()


class Bucket:
    def __init__(self) -> None:
        self.name = os.environ.get("R2_BUCKET") or "openaudit"
        self.s3 = boto3.client(
            "s3",
            endpoint_url=need("R2_S3_ENDPOINT"),
            aws_access_key_id=need("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=need("R2_SECRET_ACCESS_KEY"),
            region_name="auto",
            config=Config(
                max_pool_connections=32, retries={"max_attempts": 5, "mode": "standard"}
            ),
        )

    def put(self, key: str, body: bytes, content_type: str) -> None:
        self.s3.put_object(
            Bucket=self.name, Key=key, Body=body, ContentType=content_type
        )

    def put_file(self, key: str, path: Path, content_type: str) -> None:
        """Uploads the file in parts, so that a big log is never in memory."""
        self.s3.upload_file(
            str(path), self.name, key, ExtraArgs={"ContentType": content_type}
        )

    def get(self, key: str) -> bytes:
        return self.s3.get_object(Bucket=self.name, Key=key)["Body"].read()

    def get_or_none(self, key: str) -> bytes | None:
        try:
            return self.get(key)
        except self.s3.exceptions.NoSuchKey:
            return None

    def list_keys(self, prefix: str) -> list[str]:
        return [
            o["Key"]
            for page in self.s3.get_paginator("list_objects_v2").paginate(
                Bucket=self.name, Prefix=prefix
            )
            for o in page.get("Contents", [])
        ]

    def has_prefix(self, prefix: str) -> bool:
        page = self.s3.list_objects_v2(Bucket=self.name, Prefix=prefix, MaxKeys=1)
        return bool(page.get("Contents"))

    def put_json(self, key: str, value: Any) -> int:
        body = json_bytes(value)
        self.put(key, body, "application/json")
        return len(body)

    def put_many_json(
        self, items: Iterable[tuple[str, Any]], workers: int = 16
    ) -> list[int]:
        with ThreadPoolExecutor(workers) as pool:
            return list(pool.map(lambda kv: self.put_json(*kv), items))

    def delete_prefix(self, prefix: str, *, checked: bool = False) -> int:
        """`checked`: only `run_files.delete_run_files` may delete run files."""
        if not checked:
            refuse_run_files(prefix)
        count = 0
        for page in self.s3.get_paginator("list_objects_v2").paginate(
            Bucket=self.name, Prefix=prefix
        ):
            keys = [{"Key": o["Key"]} for o in page.get("Contents", [])]
            if keys:
                self.s3.delete_objects(Bucket=self.name, Delete={"Objects": keys})
                count += len(keys)
        return count
