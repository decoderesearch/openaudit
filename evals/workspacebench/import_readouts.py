"""Copies readouts that were made elsewhere into a run's --out, for --judge-only:

  python3 import_readouts.py --out out/ours-<version>/olens --from <dir of <family>.jsonl> \
      --source <url> [--families a,b]
      [--caches <dir of <family>/cells.jsonl> --cache-families c,d --cache-source <url>]

`--caches` copies the judge call caches of some families (only where the judge settings are the
same as the source's), so their cached calls cost nothing. `out/readout_sources.json` records the
source and sha256 of each file, and run.py puts it in results.json. Python standard library only.
"""

import argparse
import hashlib
import json
import shutil
from pathlib import Path


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawTextHelpFormatter)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--from", dest="src", required=True, type=Path)
    p.add_argument("--source", required=True, help="where the files came from (a URL)")
    p.add_argument("--families", default=None, help="comma list (default: all files in --from)")
    p.add_argument("--caches", default=None, type=Path)
    p.add_argument("--cache-families", default="")
    p.add_argument(
        "--cache-source", default=None, help="where the caches came from (default: --source)"
    )
    args = p.parse_args()

    fams = (
        args.families.split(",")
        if args.families
        else sorted(x.stem for x in args.src.glob("*.jsonl"))
    )
    (args.out / "readouts").mkdir(parents=True, exist_ok=True)
    path = args.out / "readout_sources.json"
    sources = json.loads(path.read_text()) if path.exists() else {}
    for fam in fams:
        src = args.src / f"{fam}.jsonl"
        meta = src.with_name(src.name + ".meta.json")
        if not (src.exists() and meta.exists()):
            raise SystemExit(f"{fam}: {src} or its sidecar is missing")
        dst = args.out / "readouts" / src.name
        shutil.copyfile(src, dst)
        shutil.copyfile(meta, dst.with_name(dst.name + ".meta.json"))
        sources[fam] = {"source": args.source, "sha256": sha256_of(dst)}
        print(f"{fam:36s} readouts from {args.source}")
    for fam in filter(None, args.cache_families.split(",")):
        if fam not in fams:
            raise SystemExit(f"{fam}: a cache needs the readouts of the same source")
        cache = args.caches / fam / "cells.jsonl"
        dst = args.out / "judge" / fam / "cells.jsonl"
        if dst.exists():
            raise SystemExit(f"{dst} exists: a judge run started there")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(cache, dst)
        sources[fam]["judgeCache"] = {
            "source": args.cache_source or args.source,
            "sha256": sha256_of(dst),
        }
        print(f"{fam:36s} judge cache from {args.cache_source or args.source}")
    path.write_text(json.dumps(sources, indent=1, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
