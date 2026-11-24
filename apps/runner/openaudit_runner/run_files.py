"""Deletes a run's files in R2. Dev and production share the bucket, and sync copies a run to
production with the same id and keys. So a delete goes on only when no Neon branch links a file
under the run's prefix."""

from typing import Any
from uuid import UUID

import httpx

from .env import need
from .store import Bucket, connect

REFS = """
SELECT (SELECT count(*) FROM eval_run
        WHERE id = %(id)s OR "logKey" LIKE %(prefix)s OR "redactedKey" LIKE %(prefix)s)
     + (SELECT count(*) FROM eval_run_shard WHERE "runId" = %(id)s OR "logKey" LIKE %(prefix)s)
     + (SELECT count(*) FROM eval_attempt WHERE "runId" = %(id)s OR "bodyKey" LIKE %(prefix)s) AS n
"""


def prefix(run_id: str) -> str:
    return f"runs/{run_id}/"


def neon_databases() -> list[tuple[str, str]]:
    """(label, URL) of the database on each branch of the Neon project. Keep the URLs in memory."""
    project = need("NEON_PROJECT_ID")
    headers = {"Authorization": f"Bearer {need('NEON_API_KEY')}"}

    def get(path: str, **params: str) -> Any:
        r = httpx.get(
            f"https://console.neon.tech/api/v2/projects/{project}{path}",
            params=params,
            headers=headers,
            timeout=30,
        )
        if r.status_code != 200:
            raise SystemExit(f"Neon API {path}: HTTP {r.status_code}")
        return r.json()

    out = []
    for branch in get("/branches")["branches"]:
        for db in get(f"/branches/{branch['id']}/databases")["databases"]:
            uri = get(
                "/connection_uri",
                branch_id=branch["id"],
                database_name=db["name"],
                role_name=db["owner_name"],
                pooled="false",
            )["uri"]
            out.append((f"{branch['name']}/{db['name']}", uri))
    return out


def links(databases: list[tuple[str, str]], run_id: str) -> dict[str, int]:
    """The rows in each database that link the run or a file under its prefix."""
    out = {}
    for label, url in databases:
        with connect(url) as conn:
            row = conn.execute(REFS, {"id": run_id, "prefix": prefix(run_id) + "%"}).fetchone()
            out[label] = int(row["n"])
    return out


def delete_run_files(
    bucket: Bucket, run_ids: list[str], *, apply: bool, databases: list[tuple[str, str]] | None = None
) -> int:
    """Deletes the files of the runs that no database links. Prints each run's links. With
    `apply` false, deletes nothing. Returns the count of files deleted, or that a delete would take."""
    databases = databases if databases is not None else neon_databases()
    total = 0
    for run_id in (str(UUID(r)) for r in run_ids):
        found = links(databases, run_id)
        keys = bucket.list_keys(prefix(run_id))
        linked = {k: n for k, n in found.items() if n}
        if linked:
            print(f"{run_id}: kept, {len(keys)} files. Linked by {linked}.")
            continue
        if apply:
            bucket.delete_prefix(prefix(run_id), checked=True)
        total += len(keys)
        print(f"{run_id}: {'deleted' if apply else 'would delete'} {len(keys)} files.")
    return total
