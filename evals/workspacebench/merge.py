"""Merges the readouts of --shard runs (--produce-only) into one --out, for --judge-only:

  python3 merge.py out/olens out/olens-shard0 out/olens-shard1 ...

Each family's readouts are the shards' rows, one copy of each item. The shards must be of one
version and one lens. This file needs only the Python standard library.
"""

import json
import sys
from pathlib import Path


def merge(dest: Path, shards: list[Path]) -> dict[str, int]:
    versions = {(s / "version.txt").read_text().strip() for s in shards}
    if len(versions) != 1:
        raise SystemExit(f"the shards have versions {sorted(versions)}: merge one version")
    (dest / "readouts").mkdir(parents=True, exist_ok=True)
    (dest / "version.txt").write_text(versions.pop() + "\n")
    families = sorted({p.stem for s in shards for p in (s / "readouts").glob("*.jsonl")})
    counts = {}
    for fam in families:
        seen: set[str] = set()
        metas = set()
        with open(dest / "readouts" / f"{fam}.jsonl", "w", encoding="utf-8") as out:
            for s in shards:
                path = s / "readouts" / f"{fam}.jsonl"
                if not path.exists():
                    continue
                meta = path.with_name(path.name + ".meta.json")
                metas.add(meta.read_text() if meta.exists() else "")
                ids = set()
                for line in path.read_text(encoding="utf-8").splitlines():
                    if line.strip():
                        row = json.loads(line)
                        if row["id"] in seen:
                            continue
                        ids.add(row["id"])
                        out.write(line + "\n")
                seen |= ids
        if len(metas) != 1 or "" in metas:
            raise SystemExit(f"{fam}: the shards' readout sidecars are missing or differ")
        (dest / "readouts" / f"{fam}.jsonl.meta.json").write_text(metas.pop())
        counts[fam] = len(seen)
    return counts


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    for fam, n in merge(Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]]).items():
        print(f"{fam:36s} {n} items")
