"""Writes one Inspect log for each subject model of our Workspace Lens Readout run, so that the
runner can import it as a run of version 2026-10.2: data/cache/workspace-lens-readout/logs/<model>.eval.
With --strip, for version 2026-10.3: from samples-strip/ to logs-strip/.

Reads the files that data/scripts/rlens-fit/readout_samples.py writes, in
data/cache/workspace-lens-readout/samples/<model>_readout_samples.jsonl.gz. Each item of the five
tasks is one sample: the prompt, the hidden tokens as the target, and the model's greedy next token
as the reply. Each lens has one score: the share of the item's hidden tokens that it ranks in its top
10 at one of the seven readout layers or more. All items have scores, except the J++ fit split.
Each lens also has `<lens>/<metric>` scores: recall@1, and the recall@10 of the sample's task.
The sample metadata has the top tokens and the ranks of each lens at each layer (`lensReadout`).
Uses the runner's Inspect version:
  cd apps/runner && uv run python ../../data/scripts/workspace-lens-readout-logs.py
Then import each log:
  uv run openaudit-runner import <log> --model <subject> --eval workspace-lens-readout
"""

import argparse
import gzip
import json
from datetime import UTC, datetime
from pathlib import Path

from inspect_ai import __version__ as inspect_version
from inspect_ai.log import (
    EvalConfig,
    EvalDataset,
    EvalLog,
    EvalSample,
    EvalSpec,
    EvalStats,
    write_eval_log,
)
from inspect_ai.model import ChatMessageAssistant, ChatMessageUser, ModelOutput
from inspect_ai.scorer import Score

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "workspace-lens-readout"
TASK = "openaudit_runner/workspace_lens_readout"
JPP_REPO = "safety-research/jpp_lens"
JPP_COMMIT = "d7efc0de372e20589e899188c0cfe8434acc63ec"
K = 10
# The paper's seven readout layers of each model.
READOUT_LAYERS = {
    "Qwen/Qwen3.6-27B": [8, 16, 24, 32, 40, 48, 56],
    "google/gemma-4-31B": [8, 15, 22, 30, 38, 45, 52],
    "allenai/Olmo-3-1125-32B": [8, 16, 24, 32, 40, 48, 56],
    "Qwen/Qwen3.5-9B": [4, 8, 12, 16, 20, 24, 28],
    "Qwen/Qwen3.5-122B-A10B": [6, 12, 18, 24, 30, 36, 42],
    "deepseek-ai/DeepSeek-V4-Flash": [5, 11, 16, 22, 27, 32, 38],
}
# The score key of each lens file, by the end of its name.
LENS_KEYS = [
    ("_rlens", "r_lens"),
    ("_cb_rlens_n25", "r_lens"),
    ("_jpp_lens", "jpp_lens"),
    ("_jacobian_lens", "jacobian_lens"),
    ("_jacobian_lens_n1000", "jacobian_lens"),
    ("_cb_jlens_n25", "jacobian_lens"),
    ("logit", "logit_lens"),
]
NOTE = (
    "OpenAudit ran this on {gpu} with the jpp_lens harness (commit {commit}). {lenses} A sample "
    "has scores when a hidden token is one token and the J++ Lens did not fit on it. Samples that "
    "the model answers wrong also count: the harness drops them, but the test is of the lens, not "
    "the model. {space}"
)
SPACE = {
    False: "As in the harness, a prompt that ends in a space is read at the space token.",
    True: (
        "A prompt that ends in a space is read without it, at the token before the answer. A "
        "number answer keeps the space, because the tokenizer splits it from the number."
    ),
}
NP_LENSES = (
    "The J-Lens and the J++ Lens are the Neuronpedia files; the R-Lens is our fit on 64 "
    "WikiText-103 prompts."
)
CB_JLENS = (
    "The J++ Lens is the Neuronpedia file; the J-Lens is Camila Blank's fit on 25 Pile prompts; "
    "the R-Lens is our fit on 64 WikiText-103 prompts."
)
# The GPUs and the lens sources of each model, if they are not one H200 and NP_LENSES.
RUNS = {
    "Qwen/Qwen3.5-9B": ("one H200", CB_JLENS),
    "Qwen/Qwen3.5-122B-A10B": ("three H200s", CB_JLENS),
    "deepseek-ai/DeepSeek-V4-Flash": (
        "four RTX PRO 6000s, with the model's own 8-bit weights,",
        (
            "The J++ Lens is the Neuronpedia file; the J-Lens and the R-Lens are Camila Blank's "
            "fits on 25 Pile prompts."
        ),
    ),
}
# The GPUs of the 2026-10.3 runs, if not one H200.
STRIP_GPUS = {
    "Qwen/Qwen3.5-122B-A10B": "two H200s",
    "deepseek-ai/DeepSeek-V4-Flash": "two H200s, with the model's own 8-bit weights,",
}
WHY_NOT = {
    "fit": "The J++ Lens fitted its expert weights on this sample, so the results do not count it.",
    "token": "No hidden token is one token for this model, so the results do not count this sample.",
}


def lens_key(name: str) -> str:
    return next(key for end, key in LENS_KEYS if name.endswith(end))


def why_not(row: dict) -> str | None:
    if not row.get("lenses"):
        return "token"
    return "fit" if row["split"] == "fit" else None


def build(path: Path, logs: str) -> tuple[Path, dict[str, float]]:
    with gzip.open(path, "rt") as f:
        lines = [json.loads(line) for line in f]
    header, rows = lines[0]["header"], lines[1:]
    subject = header["model"]
    strip = header.get("strip_word_answers", False)
    gpu = (STRIP_GPUS.get(subject) if strip else None) or RUNS.get(subject, ("one H200",))[0]
    layers = header["layers"]
    readout = READOUT_LAYERS[subject]
    at = [layers.index(x) for x in readout]
    keys = {name: lens_key(name) for name in header["lenses"]}
    model = f"hf/{subject}"
    when = datetime.fromtimestamp(path.stat().st_mtime, UTC).isoformat()
    recall: dict[str, dict[str, list[float]]] = {k: {} for k in keys.values()}
    samples = []
    for row in rows:
        sid = f"{row['eval']}/{row['item']}"
        reply = row["model_top"][0][0] if row["model_top"] else ""
        why = why_not(row)
        scores = {}
        readouts = {}
        for name, d in (row.get("lenses") or {}).items():
            key = keys[name]
            best = {t: min(r[i] for i in at) for t, r in d["ranks"].items()}
            readouts[key] = {
                "file": Path(header["lenses"][name]).name,
                "top": d["top"],
                "ranks": d["ranks"],
            }
            if why:
                continue
            value = sum(r <= K for r in best.values()) / len(best)
            recall[key].setdefault(row["eval"], []).append(value)
            found = ", ".join(f"{t}: rank {r}" for t, r in best.items())
            scores[key] = Score(
                value=round(value, 4),
                explanation=f"The best rank of each hidden token at the readout layers. {found}.",
            )
            # The other metrics on this sample, as `<lens>/<metric>`. A task's recall@10 has a
            # value only on the samples of that task.
            top1 = sum(r <= 1 for r in best.values()) / len(best)
            scores[f"{key}/recall_at_1"] = Score(value=round(top1, 4))
            scores[f"{key}/{row['eval']}_recall_at_10"] = Score(value=round(value, 4))
        metadata = {
            "task": row["eval"],
            "answer": row["target"],
            "readoutToken": row.get("readout_token"),
            "modelTop": row["model_top"],
            "modelCorrect": row["correct"],
            "split": row["split"],
            "scored": not why,
            **({"notScored": WHY_NOT[why]} if why else {}),
            **({"droppedTokens": row["dropped"]} if row.get("dropped") else {}),
            **(
                {
                    "lensReadout": {
                        "layers": layers,
                        "readoutLayers": readout,
                        "k": K,
                        "readoutFilter": header["readout_filter"],
                        "lenses": readouts,
                    }
                }
                if readouts
                else {}
            ),
        }
        samples.append(
            EvalSample(
                id=sid,
                epoch=1,
                input=row["prompt"],
                target=row["intermediates"],
                messages=[
                    ChatMessageUser(content=row["prompt"]),
                    ChatMessageAssistant(content=reply, model=model),
                ],
                output=ModelOutput.from_content(model=model, content=reply),
                scores=scores,
                metadata=metadata,
            )
        )
    macro = {
        key: round(sum(sum(v) / len(v) for v in by_task.values()) / len(by_task), 4)
        for key, by_task in recall.items()
    }
    log = EvalLog(
        status="success",
        eval=EvalSpec(
            created=when,
            task=TASK,
            task_args={"k": K, "readout_layers": readout},
            dataset=EvalDataset(
                name=JPP_REPO,
                location=f"https://github.com/{JPP_REPO}/tree/{JPP_COMMIT}/data/jlens/evaluations",
                samples=len(samples),
                sample_ids=[s.id for s in samples],
                shuffled=False,
            ),
            model=model,
            config=EvalConfig(),
            packages={"inspect_ai": inspect_version},
            metadata={
                "source": f"https://github.com/{JPP_REPO}",
                "lenses": {keys[n]: f for n, f in header["lenses"].items()},
                "note": NOTE.format(
                    gpu=gpu,
                    lenses=RUNS.get(subject, (None, NP_LENSES))[1],
                    commit=JPP_COMMIT[:8],
                    space=SPACE[strip],
                ),
            },
        ),
        stats=EvalStats(started_at=when, completed_at=when),
        samples=samples,
    )
    out = CACHE / logs / f"{subject.replace('/', '-')}.eval"
    out.parent.mkdir(parents=True, exist_ok=True)
    write_eval_log(log, str(out), format="eval")
    return out, macro


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Sample files, separated by commas (default: all).")
    ap.add_argument("--strip", action="store_true", help="The 2026-10.3 samples and logs.")
    args = ap.parse_args()
    samples, logs = ("samples-strip", "logs-strip") if args.strip else ("samples", "logs")
    files = sorted((CACHE / samples).glob("*_readout_samples.jsonl.gz"))
    if args.only:
        files = [f for f in files if any(o in f.name for o in args.only.split(","))]
    for f in files:
        out, macro = build(f, logs)
        print(
            f"{f.name}: recall@{K} {macro} -> {out} ({out.stat().st_size >> 10} KB)",
            flush=True,
        )


if __name__ == "__main__":
    main()
