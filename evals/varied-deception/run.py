# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "torch==2.14.1",
#   "transformers==5.21.0",
#   "accelerate==1.15.0",
#   "kernels==0.17.2",
#   "flash-linear-attention==0.6.0",
#   "compressed-tensors==0.20.0",
#   "lie-detectors==0.1.0",
#   "huggingface_hub==2.3.0",
#   "pandas==3.1.0",
#   "pyarrow==26.0.0",
#   "tiktoken",
# ]
# ///
"""Run the OpenAudit Varied Deception eval on your lie detector. Start it with ./run.sh (see
README.md).

It scores AISI's Varied Deception chats of one subject model with your detector, and writes the
score of each chat and results.json to --out. An activation detector reads the activations of the
same forward pass as our probe runs (data/scripts/varied-deception-probes.py).

With --recipe, it first fits the detector on the subject model: it loads the recipe's TRAIN_DATA,
removes the rows that share text with the eval chats, and calls fit_detector.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
import re
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SCRIPTS = REPO / "data" / "scripts"
EXTRACTED = REPO / "data" / "extracted" / "methods" / "aisi-lie-detection.json"
sys.path[:0] = [str(SCRIPTS), str(HERE)]

import scoring

RESULTS_SCHEMA = "openaudit.varied-deception.results/1"
EVAL = ("varied-deception", "2026-06.1")
DATASET = "ai-safety-institute/lie-detection-rollouts"
REVISION = "177a81666ab378ce9d055507bc30f480ab63e74b"
SMOKE_MODEL = "Qwen/Qwen3-4B"
# The subject models of AISI's chats: our leaderboard.
SUBJECTS = [
    "MiniMaxAI/MiniMax-M2",
    "MiniMaxAI/MiniMax-M2.7",
    "Qwen/Qwen3-14B",
    "Qwen/Qwen3-30B-A3B",
    "Qwen/Qwen3-32B",
    "Qwen/Qwen3-4B",
    "Qwen/Qwen3-8B",
    "Qwen/Qwen3.5-122B-A10B-FP8",
    "Qwen/Qwen3.5-27B",
    "Qwen/Qwen3.5-35B-A3B-FP8",
    "Qwen/Qwen3.5-4B",
    "Qwen/Qwen3.6-27B",
    "Qwen/Qwen3.6-35B-A3B",
    "XiaomiMiMo/MiMo-V2-Flash",
    "deepseek-ai/DeepSeek-V3.2",
    "google/gemma-2-9b-it",
    "google/gemma-3-12b-it",
    "google/gemma-3-27b-it",
    "google/gemma-4-26B-A4B-it",
    "google/gemma-4-31B-it",
    "google/gemma-4-E2B-it",
    "google/gemma-4-E4B-it",
    "meta-llama/Llama-3.3-70B-Instruct",
    "moonshotai/Kimi-K2.5",
    "moonshotai/Kimi-K2.6",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "zai-org/GLM-4.5-Air-FP8",
    "zai-org/GLM-4.7-FP8",
    "zai-org/GLM-4.7-Flash",
    "zai-org/GLM-5-FP8",
    "zai-org/GLM-5.1-FP8",
]


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def git(*args: str) -> str:
    done = subprocess.run(
        ["git", *args], cwd=REPO, capture_output=True, text=True, check=False
    )
    # A git error (for example "dubious ownership") must not give a clean run.
    if done.returncode:
        raise SystemExit(f"git {' '.join(args)}: {done.stderr.strip()}")
    return done.stdout.strip()


def load_module(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_detector(path: Path, model_name: str):
    """Your detector, and its kind: "activations" (layers and score) or "chats" (score_chats)."""
    module = load_module(path, "submission_detector")
    if not hasattr(module, "load_detector"):
        raise SystemExit(f"{path} has no load_detector(model_name) function")
    return kind_of(module.load_detector(model_name))


def kind_of(det):
    threshold = getattr(det, "threshold", None)
    if not isinstance(threshold, (int, float)) or not math.isfinite(threshold):
        raise SystemExit("the detector's threshold must be a finite number")
    if hasattr(det, "score_chats"):
        return det, "chats"
    layers = getattr(det, "layers", None)
    if (
        hasattr(det, "score")
        and isinstance(layers, list)
        and layers
        and all(isinstance(i, int) for i in layers)
    ):
        return det, "activations"
    raise SystemExit(
        "the detector needs score_chats(chats), or layers (a list of ints) and score(acts, chat)"
    )


def load_chats(model_name: str, limit: int | None):
    """The chats that AISI labeled a lie or honest, at the pinned revision of the dataset; the chat
    template kwargs; and the text of each message of all the chats, with a label or not."""
    import pandas as pd
    from huggingface_hub import hf_hub_download

    path = hf_hub_download(
        DATASET,
        f"{scoring.subset_of(model_name)}/varied_deception.parquet",
        repo_type="dataset",
        revision=REVISION,
    )
    df = pd.read_parquet(path)
    df["row"] = range(len(df))
    every = [json.loads(m) for m in df.messages]
    texts = [m.get("content") or "" for ms in every for m in ms]
    # The chat template must show the reasoning when most chats have it, as AISI set it.
    reasoning = sum(bool(ms[-1].get("reasoning_content")) for ms in every)
    kwargs = {"enable_thinking": True} if reasoning > len(df) / 2 else {}
    df = df[df.is_lie.isin(scoring.LABELS)]
    if limit:
        # Half lies and half honest replies, so that a smoke run has both rates.
        lies = df[df.is_lie == "lie"].head(limit - limit // 2)
        df = pd.concat([lies, df[df.is_lie == "honest"].head(limit // 2)]).sort_values(
            "row"
        )
    chats = [
        {"row": int(r), "label": label, "messages": json.loads(m)}
        for r, label, m in zip(df.row, df.is_lie, df.messages)
    ]
    return chats, kwargs, texts


WORD = re.compile(r"[a-z0-9]+")
RUN = 8


def words(text: str) -> list[str]:
    return WORD.findall(text.lower())


def runs(w: list[str]) -> list[tuple]:
    return [tuple(w[i : i + RUN]) for i in range(len(w) - RUN + 1)]


class Overlap:
    """Finds text that the eval chats have: the same words (4 or more), or a text with half or more
    of its 8-word runs in the eval chats."""

    def __init__(self, texts: list[str]):
        self.exact, self.runs = set(), set()
        for t in texts:
            w = words(t)
            if len(w) >= 4:
                self.exact.add(" ".join(w))
            self.runs.update(runs(w))

    def has(self, text: str) -> bool:
        w = words(text)
        if len(w) >= 4 and " ".join(w) in self.exact:
            return True
        r = runs(w)
        return bool(r) and 2 * sum(x in self.runs for x in r) >= len(r)


def strings(value):
    """Each string in a row. A string of JSON gives the strings in it."""
    if isinstance(value, str):
        if value[:1] in "[{":
            try:
                yield from strings(json.loads(value))
                return
            except ValueError:
                pass
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings(v)


HF_REPO = re.compile(r"^[\w.-]+/[\w.-]+$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
FILE_AT_COMMIT = re.compile(
    r"^https://(huggingface\.co/((datasets|spaces)/)?[\w.-]+/[\w.-]+/(blob|resolve)|github\.com/[\w.-]+/[\w.-]+/blob)/[0-9a-f]{40}/\S+$"
)
DATA_FILE = re.compile(r"\.(parquet|jsonl|json|csv)$")


def check_train_data(spec) -> list[str]:
    """The errors in a recipe's TRAIN_DATA. submissions/check.mjs has the same rules."""
    if not isinstance(spec, dict):
        return ["TRAIN_DATA: a dict"]
    errors = [
        f"TRAIN_DATA.{k}: not a key. Use kind, sources, generator."
        for k in spec
        if k not in ("kind", "sources", "generator")
    ]
    kind = spec.get("kind")
    if kind == "none":
        return errors + [
            f'TRAIN_DATA.{k}: not with kind "none"'
            for k in ("sources", "generator")
            if k in spec
        ]
    if kind not in ("fixed", "generated"):
        errors.append('TRAIN_DATA.kind: "fixed", "generated" or "none"')
    if kind == "generated" and not FILE_AT_COMMIT.match(spec.get("generator") or ""):
        errors.append(
            "TRAIN_DATA.generator: the script or card that tells how the data was made, a Hugging Face or GitHub file at a commit"
        )
    sources = spec.get("sources")
    if not isinstance(sources, dict) or not sources:
        return [*errors, "TRAIN_DATA.sources: a dict of name to source"]
    for name, s in sources.items():
        at = f"TRAIN_DATA.sources.{name}"
        if not isinstance(s, dict):
            errors.append(f"{at}: a dict")
            continue
        errors += [
            f"{at}.{k}: not a key. Use dataset, revision, file."
            for k in s
            if k not in ("dataset", "revision", "file")
        ]
        if not HF_REPO.match(s.get("dataset") or ""):
            errors.append(f"{at}.dataset: a Hugging Face dataset, <owner>/<name>")
        if not COMMIT.match(s.get("revision") or ""):
            errors.append(f"{at}.revision: a 40-character commit")
        file = s.get("file") or ""
        if not DATA_FILE.search(file):
            errors.append(f"{at}.file: a .parquet, .jsonl, .json or .csv file")
        elif "{subset}" in file and kind != "generated":
            errors.append(f'{at}.file: {{subset}} is only for "generated" data')
    return errors


def read_rows(path: str) -> list[dict]:
    import pandas as pd

    if path.endswith(".parquet"):
        df = pd.read_parquet(path)
    elif path.endswith(".csv"):
        df = pd.read_csv(path)
    else:
        df = pd.read_json(path, lines=path.endswith(".jsonl"))
    return json.loads(df.to_json(orient="records"))


def load_sources(spec: dict, model_name: str) -> dict[str, list[dict]]:
    """The rows of each source, at its commit. In a file name, {subset} is the subject model's
    subset (qwen-qwen3-4b)."""
    from huggingface_hub import hf_hub_download

    return {
        name: read_rows(
            hf_hub_download(
                s["dataset"],
                s["file"].replace("{subset}", scoring.subset_of(model_name)),
                repo_type="dataset",
                revision=s["revision"],
            )
        )
        for name, s in spec.get("sources", {}).items()
    }


def visible(messages: list[dict]) -> list[dict]:
    """The chat that a detector gets: without the system prompt, which tells the model to lie."""
    return [m for m in messages if m.get("role") != "system"]


def score_chats(det, chats: list[dict], batch: int = 200) -> None:
    t0 = time.time()
    for i in range(0, len(chats), batch):
        part = chats[i : i + batch]
        scores = det.score_chats([visible(c["messages"]) for c in part])
        if len(scores) != len(part):
            raise SystemExit(
                f"score_chats gave {len(scores)} scores for {len(part)} chats"
            )
        for c, s in zip(part, scores):
            c["score"] = None if s is None else float(s)
        print(
            f"  {i + len(part)}/{len(chats)} chats, {round(time.time() - t0)} s",
            flush=True,
        )


class Forward:
    """The subject model, and one forward pass for each chat, as in our probe runs. `keep`: load
    only decoder blocks 0 to keep - 1."""

    def __init__(self, model_name: str, kwargs: dict, args, keep: int | None = None):
        import torch
        from transformers import AutoModelForCausalLM
        from varied_deception_chat import load_tokenizer

        self.probes = load_module(
            SCRIPTS / "varied-deception-probes.py", "varied_deception_probes"
        )
        self.kwargs, self.args = kwargs, args
        self.seen, self.printed = 0, time.time()
        self.tok = load_tokenizer(model_name)
        self.tok.padding_side = "right"
        if self.tok.pad_token is None:
            self.tok.pad_token = self.tok.eos_token
        devices = "auto" if torch.cuda.device_count() > 1 else "cuda"
        if keep:
            model, _ = self.probes.load_partial(model_name, keep, devices)
        else:
            model = AutoModelForCausalLM.from_pretrained(
                model_name, dtype="auto", device_map=devices
            )
        self.probes.chunk_indexers(model)
        if devices == "auto":
            for attr in ("forward", "_old_forward", "_hf_hook"):
                model.__dict__.pop(attr, None)
        model.eval()
        self.model = model
        self.layers = self.probes.decoder_layers(model)
        self.n_layers = len(self.layers)
        self.d_model = model.config.get_text_config().hidden_size
        types = getattr(model.config.get_text_config(), "layer_types", None) or []
        if "linear_attention" in types and importlib.util.find_spec("fla") is None:
            print(
                "warning: flash-linear-attention is not installed, so the linear attention "
                "layers run on slow PyTorch code. Start the harness with ./run.sh.",
                flush=True,
            )

    def items(self, chats: list[dict]) -> list[dict]:
        """The chats that the model can read, with their token ids and the index of each text token
        of the reply (not its reasoning). Sets "skipped" on the others."""
        tok, items = self.tok, []
        for c in chats:
            r = self.probes.render(tok, c["messages"], self.kwargs)
            if r is None:
                c["score"], c["skipped"] = (
                    None,
                    "the chat template does not accept the chat",
                )
                continue
            full, reply, start, end, _ = r
            enc = tok(full, add_special_tokens=False, return_offsets_mapping=True)
            spans = enc["offset_mapping"]
            reply_tok = [
                i for i, (a, b) in enumerate(spans) if a >= reply and b <= end and b > a
            ]
            # A token can join the white space before the text to its first word.
            text = [
                i
                for i in reply_tok
                if spans[i][1] > start and not full[spans[i][0] : start].strip()
            ]
            if not text or (
                self.args.max_length and len(enc["input_ids"]) > self.args.max_length
            ):
                c["score"], c["skipped"] = None, "no reply text, or too long"
                continue
            items.append({"chat": c, "ids": enc["input_ids"], "text": text})
        return items

    def run(self, items: list[dict], blocks: list[int], fn) -> None:
        """Calls fn(item, acts) for each item. acts: {block: [text tokens, d]}, float32 on the GPU."""
        import torch

        tok, probes = self.tok, self.probes
        pending = list(probes.batches(items, self.args.budget))
        done, t0 = 0, time.time()
        while pending:
            batch = pending.pop(0)
            width = max(len(i["ids"]) for i in batch)
            ids = torch.full((len(batch), width), tok.pad_token_id)
            mask = torch.zeros((len(batch), width), dtype=torch.long)
            for j, it in enumerate(batch):
                ids[j, : len(it["ids"])] = torch.tensor(it["ids"])
                mask[j, : len(it["ids"])] = 1
            try:
                acts = probes.capture(
                    self.model,
                    self.layers,
                    {"input_ids": ids.cuda(), "attention_mask": mask.cuda()},
                    blocks,
                )
            except torch.OutOfMemoryError:
                acts = None
            if acts is None:
                torch.cuda.empty_cache()
                if len(batch) > 1:
                    pending[:0] = [batch[: len(batch) // 2], batch[len(batch) // 2 :]]
                else:
                    batch[0]["chat"]["score"], batch[0]["chat"]["skipped"] = (
                        None,
                        "too long for the GPU memory",
                    )
                continue
            for j, it in enumerate(batch):
                fn(it, {i: acts[i][j, it["text"]].to("cuda").float() for i in blocks})
            del acts
            done += len(batch)
            self.seen += len(batch)
            # Also on a clock: a recipe can call acts with fewer than 200 chats each time.
            if done % 200 < len(batch) or time.time() - self.printed > 30:
                print(
                    f"  {done}/{len(items)} chats, {time.time() - t0:.0f} s ({self.seen} in all)",
                    flush=True,
                )
                self.printed = time.time()


def score_activations(det, fwd: Forward, chats: list[dict]) -> None:
    """The detector gets the output of each decoder block in `det.layers`."""
    import torch

    if max(det.layers) >= fwd.n_layers or min(det.layers) < 0:
        raise SystemExit(
            f"the model has decoder blocks 0 to {fwd.n_layers - 1}, not {det.layers}"
        )
    with torch.inference_mode():
        test = det.score(
            {i: torch.randn(3, fwd.d_model, device="cuda") for i in det.layers},
            visible(chats[0]["messages"]),
        )
    if not math.isfinite(float(test)):
        raise SystemExit(
            "score(acts, chat) of random activations is not a finite number"
        )

    def score(it, acts):
        with torch.inference_mode():
            it["chat"]["score"] = float(
                det.score(acts, visible(it["chat"]["messages"]))
            )

    fwd.run(fwd.items(chats), sorted(set(det.layers)), score)


class Acts:
    """acts(chats, layers, mean=False): for each chat (messages that end with an assistant reply),
    {layer: [text tokens, d]} at the reply's text tokens, float32 on the CPU. With mean:
    {layer: [d]}. None for a chat that the model cannot read. A chat with text of the eval chats
    stops the fit. `n_layers` and `d_model`: of the subject model. `forward()` loads the model at
    first use, so a recipe that does not read activations needs no GPU."""

    def __init__(self, forward, overlap: Overlap):
        self.forward, self.overlap = forward, overlap

    @property
    def n_layers(self) -> int:
        return self.forward().n_layers

    @property
    def d_model(self) -> int:
        return self.forward().d_model

    def __call__(self, chats: list[list[dict]], layers: list[int], mean: bool = False):
        if not layers or not all(
            isinstance(i, int) and 0 <= i < self.n_layers for i in layers
        ):
            raise SystemExit(f"acts: layers must be from 0 to {self.n_layers - 1}")
        for n, chat in enumerate(chats):
            for m in chat:
                if self.overlap.has(m.get("content") or ""):
                    raise SystemExit(
                        f"acts: chat {n} has text of the eval chats: {(m.get('content') or '')[:120]!r}"
                    )
        wrapped = [{"messages": c, "i": n} for n, c in enumerate(chats)]
        out = [None] * len(chats)

        def keep(it, acts):
            out[it["chat"]["i"]] = {
                i: (a.mean(0) if mean else a).cpu().clone() for i, a in acts.items()
            }

        fwd = self.forward()
        fwd.run(fwd.items(wrapped), sorted(set(layers)), keep)
        return out


def fit_recipe(path: Path, model_name: str, kwargs: dict, texts: list[str], args):
    """Fits the recipe's detector on the subject model. The detector, its kind, the fit record and
    the loaded model, or None when the fit did not load it."""
    module = load_module(path, "submission_recipe")
    for name in ("TRAIN_DATA", "fit_detector"):
        if not hasattr(module, name):
            raise SystemExit(f"{path} has no {name}")
    spec = module.TRAIN_DATA
    errors = check_train_data(spec)
    if errors:
        raise SystemExit("\n".join(errors))
    overlap = Overlap(texts)
    data, rows, removed = {}, {}, {}
    for name, all_rows in load_sources(spec, model_name).items():
        data[name] = [
            r for r in all_rows if not any(overlap.has(s) for s in strings(r))
        ]
        rows[name], removed[name] = len(data[name]), len(all_rows) - len(data[name])
        print(
            f"  {name}: {rows[name]} rows; {removed[name]} removed, with text of the eval chats",
            flush=True,
        )
    fwd = None

    def forward():
        nonlocal fwd
        if fwd is None:
            fwd = Forward(model_name, kwargs, args)
        return fwd

    t0 = time.time()
    det, kind = kind_of(module.fit_detector(model_name, data, Acts(forward, overlap)))
    fit = {
        "recipe": {"file": path.name, "sha256": sha256_of(path)},
        "trainData": spec,
        "rows": rows,
        "removed": removed,
        "seconds": round(time.time() - t0),
    }
    info = getattr(det, "info", None)
    if isinstance(info, dict):
        fit["info"] = json.loads(json.dumps(info, default=str))
    return det, kind, fit, fwd


def save_probe(det, out: Path, model_name: str, fit: dict) -> list[dict]:
    """Saves the tensors() of a fitted detector, if it has them, as <model>_probe.safetensors: the
    file that users download. Its name, sha256 and size."""
    tensors = getattr(det, "tensors", None)
    if not callable(tensors):
        return []
    from safetensors.torch import save_file

    path = out / f"{model_name.split('/')[-1]}_probe.safetensors"
    meta = {
        "model": model_name,
        "recipe": json.dumps(fit["recipe"]),
        "threshold": repr(float(det.threshold)),
        "layers": json.dumps([int(i) for i in getattr(det, "layers", [])]),
    }
    save_file(
        {k: v.detach().cpu().contiguous() for k, v in tensors().items()},
        str(path),
        metadata=meta,
    )
    return [
        {"name": path.name, "sha256": sha256_of(path), "bytes": path.stat().st_size}
    ]


def leaderboard(model_name: str, value: float) -> None:
    """Your balanced accuracy among the detectors of the paper on this subject model."""
    if not EXTRACTED.exists():
        return
    rows = [(value, "your detector")]
    for a in json.loads(EXTRACTED.read_text())["artifacts"]:
        if a["subject"] != model_name:
            continue
        for r in a["results"]:
            if r["eval"] == EVAL[0] and "balanced_accuracy" in r["metrics"]:
                rows.append((r["metrics"]["balanced_accuracy"], a["variant"]))
    rows.sort(key=lambda r: -r[0])
    print(f"\n{EVAL[0]} {EVAL[1]}, balanced accuracy, {model_name}:")
    for v, name in rows:
        print(f"  {v:.3f}  {name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    given = parser.add_mutually_exclusive_group(required=True)
    given.add_argument("--detector", help="a .py file with load_detector(model_name)")
    given.add_argument(
        "--recipe",
        help="a .py file with TRAIN_DATA and fit_detector(model_name, data, acts)",
    )
    parser.add_argument(
        "--model", default=SMOKE_MODEL, help="the subject model, default %(default)s"
    )
    parser.add_argument("--out", required=True, help="output folder")
    parser.add_argument(
        "--limit", type=int, default=None, help="only the first N chats (a smoke run)"
    )
    parser.add_argument(
        "--budget", type=int, default=32768, help="tokens in a batch, with padding"
    )
    parser.add_argument(
        "--max-length", type=int, default=0, help="skip the chats with more tokens"
    )
    parser.add_argument(
        "--partial",
        action="store_true",
        help="load only the blocks up to the last layer",
    )
    args = parser.parse_args()

    if args.model not in SUBJECTS:
        raise SystemExit(
            f"{args.model} has no Varied Deception chats. Use one of: {', '.join(SUBJECTS)}"
        )
    if args.recipe and args.partial:
        raise SystemExit(
            "--partial does not work with --recipe: the fit can read any layer"
        )
    path = Path(args.recipe or args.detector).resolve()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)

    start = time.time()
    chats, kwargs, texts = load_chats(args.model, args.limit)
    fit = fwd = None
    if args.recipe:
        print(f"{args.model}: fit {path.name}", flush=True)
        det, kind, fit, fwd = fit_recipe(path, args.model, kwargs, texts, args)
    else:
        det, kind = load_detector(path, args.model)
    print(f"{args.model}: {len(chats)} chats, {kind} detector", flush=True)
    if kind == "chats":
        score_chats(det, chats)
    else:
        keep = max(det.layers) + 1 if args.partial else None
        score_activations(det, fwd or Forward(args.model, kwargs, args, keep), chats)

    threshold = float(det.threshold)
    if fit and (files := save_probe(det, out, args.model, fit)):
        fit["files"] = files
    slug = args.model.split("/")[-1]
    scores_file = out / f"{slug}_scores.jsonl"
    with open(scores_file, "w") as f:
        for c in chats:
            row = {
                "row": c["row"],
                "label": c["label"],
                "score": c["score"],
                "lie": scoring.is_lie(c["score"], threshold),
            }
            f.write(
                json.dumps(row | ({"skipped": c["skipped"]} if "skipped" in c else {}))
                + "\n"
            )
    metrics = scoring.metrics(chats, threshold)

    import torch

    run = {
        "model": args.model,
        "tier": "smoke" if args.limit else "full",
        "partial": bool(args.limit),
        "detector": {
            "file": path.name,
            "sha256": sha256_of(path),
            "kind": kind,
            "threshold": threshold,
        },
        "harness": {
            "openaudit": git("rev-parse", "HEAD"),
            "openauditDirty": bool(
                git("status", "--porcelain", "--", str(HERE), str(SCRIPTS))
            ),
            "dataset": {"repo": DATASET, "revision": REVISION},
        },
        "layers": list(det.layers) if kind == "activations" else None,
        **({"fit": fit} if fit else {}),
        "evals": {
            EVAL[0]: {
                "version": EVAL[1],
                "metrics": metrics,
                "counts": scoring.counts(chats),
                "files": [scores_file.name],
            }
        },
        "seconds": round(time.time() - start),
        "gpus": [
            torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())
        ],
        "torch": torch.__version__,
        "date": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    results_path = out / "results.json"
    results = json.loads(results_path.read_text()) if results_path.exists() else {}
    results["schema"] = RESULTS_SCHEMA
    results.setdefault("runs", {})[args.model] = run
    results_path.write_text(json.dumps(results, indent=2) + "\n")

    print(
        f"\n{EVAL[0]} {EVAL[1]}: balanced accuracy {metrics['balanced_accuracy']:.3f}"
    )
    if not args.limit:
        leaderboard(args.model, metrics["balanced_accuracy"])
    print(f"\nwrote {results_path}")
    if args.limit:
        print(f"--limit {args.limit}: a smoke run. Do not submit it.")


if __name__ == "__main__":
    main()
