"""Copies Hugging Face repos, at pinned commits, to R2 for `openaudit_runner.hf_mirror`.

Layout: `datasets/hf/<repo>/<sha>/<path>` (models: `models/hf/...`) and `<sha>/_manifest.json`.
A repo that has a manifest at that sha is not copied again.

    uv run python scripts/mirror_hf.py            # show sizes only
    uv run python scripts/mirror_hf.py --copy     # copy
    uv run python scripts/mirror_hf.py --copy dataset:org/name@sha model:org/name@sha
"""

import argparse
import fnmatch
import json
import os
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi, hf_hub_download
from openaudit_runner.env import load_env, need
from openaudit_runner.hf_mirror import MANIFEST, BucketReader, prefix

LARGE = 2e9
# Weights that transformers (torch) does not load, and training state.
NOT_TORCH = [
    "tf_model.h5",
    "flax_model.msgpack",
    "rust_model.ot",
    "*.onnx",
    "onnx/*",
    "*.ckpt",
    "coreml/*",
    "openvino/*",
    "*.tflite",
    "optimizer.pt",
    "scheduler.pt",
    "rng_state*.pth",
]
# Tokenizer and config only: Detoxify loads its weights from a GitHub release.
CONFIG_ONLY = ["*.json", "*.txt", "*.model"]

# (kind, repo, revision, files to copy or None for all). Pins come from the task code.
JOBS: list[tuple[str, str, str, list[str] | None]] = [
    # inspect_evals/abstention_bench
    ("dataset", "allenai/coconot", "2cbe16aabf9069f17e48c8daad8aeabc29469eb7", None),
    ("dataset", "amayuelas/KUQ", "f99b53aa226dbb0d1b086db3ec352b0da0aa8f41", None),
    ("dataset", "cais/mmlu", "c30699e8356da336a370243923dbaf21066bb9fe", None),
    ("dataset", "Idavidrein/gpqa", "5233cd1db58884ed0bf678c7c6be731722a23f84", None),
    (
        "dataset",
        "ninoscherrer/moralchoice",
        "89c0fe7b158b5ade5d10e0644c1aa20ab4c78cbe",
        None,
    ),
    ("dataset", "openai/gsm8k", "cc7b047b6e5bb11b4f1af84efc572db110a51b3c", None),
    ("dataset", "rajpurkar/squad_v2", "3ffb306f725f7d2ce8394bc1873b24868140c412", None),
    # Not only `known_unknowns`: datasets reads the first config in the README to pick the builder.
    (
        "dataset",
        "tasksource/bigbench",
        "210c156767d2f4f05d2f4fd0bb275017a67040fd",
        None,
    ),
    # CPU classifiers
    (
        "model",
        "LibrAI/longformer-harmful-ro",
        "dc75af6212079ccbfbb06a1705f6c458e39834f3",
        None,
    ),
    (
        "model",
        "LibrAI/longformer-action-ro",
        "bb1f0a07dcb55ae0e9af5c5431ea8075f9a92c92",
        None,
    ),
    ("model", "tomh/toxigen_roberta", "0e65216a558feba4bb167d47e49f9a9e229de6ab", None),
    (
        "model",
        "unitary/unbiased-toxic-roberta",
        "36295dd80b422dc49f40052021430dae76241adc",
        None,
    ),
    (
        "model",
        "avid-ml/bert_regard_v2_large",
        "c6efd2b48ef4520096f8a09fca0dac947f40470b",
        None,
    ),
    ("model", "FacebookAI/roberta-base", "main", CONFIG_ONLY),
]


def pick(kind: str, files: dict[str, int], only: list[str] | None) -> list[str]:
    if only is not None:
        return [p for p in files if any(fnmatch.fnmatch(p, g) for g in only)]
    keep = [p for p in files if not any(fnmatch.fnmatch(p, g) for g in NOT_TORCH)]
    if kind == "model" and any(p.endswith(".safetensors") for p in keep):
        keep = [p for p in keep if not p.endswith(".bin")]
    return keep


def parse(arg: str) -> tuple[str, str, str, None]:
    kind, rest = arg.split(":", 1)
    repo, revision = rest.split("@", 1)
    return kind, repo, revision, None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument(
        "--copy", action="store_true", help="copy (default: show sizes only)"
    )
    p.add_argument(
        "jobs", nargs="*", help="kind:org/name@revision; default: the built-in list"
    )
    args = p.parse_args()
    load_env()
    api = HfApi(token=need("HF_TOKEN"))
    reader = BucketReader()
    s3, bucket = reader.bucket.s3, reader.bucket.name
    total = 0
    for kind, repo, revision, only in [parse(a) for a in args.jobs] or JOBS:
        info = api.repo_info(
            repo, repo_type=kind, revision=revision, files_metadata=True
        )
        sha = info.sha
        meta = {s.rfilename: s for s in info.siblings or []}
        sizes = {name: s.size or 0 for name, s in meta.items()}
        chosen = pick(kind, sizes, only)
        all_mb, chosen_mb = (
            sum(sizes.values()) / 1e6,
            sum(sizes[c] for c in chosen) / 1e6,
        )
        skipped = sorted(set(sizes) - set(chosen))
        base = prefix(kind, repo, sha)
        there = reader.size(f"{base}/{MANIFEST}") is not None
        print(
            f"{kind} {repo}@{sha}: repo {all_mb:.1f} MB, copy {len(chosen)} files {chosen_mb:.1f} MB"
            f"{' (in R2)' if there else ''}",
            flush=True,
        )
        if skipped:
            print(
                f"  skip {len(skipped)} files: {', '.join(skipped[:8])}{' ...' if len(skipped) > 8 else ''}",
                flush=True,
            )
        if there or not args.copy:
            continue
        if only is None and chosen_mb * 1e6 > LARGE:
            print(
                f"  NOT COPIED: more than {LARGE / 1e9:.0f} GB. Give the files to copy.",
                flush=True,
            )
            continue
        files = []
        with tempfile.TemporaryDirectory() as d:
            for name in sorted(chosen):
                local = hf_hub_download(
                    repo,
                    name,
                    repo_type=kind,
                    revision=sha,
                    local_dir=d,
                    token=api.token,
                )
                s3.upload_file(local, bucket, f"{base}/{name}")
                s = meta[name]
                entry = {
                    "path": name,
                    "bytes": Path(local).stat().st_size,
                    "oid": s.blob_id,
                }
                if s.lfs:
                    entry["sha256"] = s.lfs.sha256
                files.append(entry)
                os.remove(local)
        source = f"https://huggingface.co/{'datasets/' if kind == 'dataset' else ''}{repo}/tree/{sha}"
        manifest = {"source": source, "repo": repo, "revision": sha, "files": files}
        reader.bucket.put(
            f"{base}/{MANIFEST}",
            json.dumps(manifest, indent=1).encode(),
            "application/json",
        )
        mb = sum(f["bytes"] for f in files) / 1e6
        total += mb
        print(f"  copied {len(files)} files, {mb:.1f} MB", flush=True)
    print(f"DONE {total:.1f} MB copied", flush=True)


if __name__ == "__main__":
    sys.exit(main())
