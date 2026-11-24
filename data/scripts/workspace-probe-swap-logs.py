"""Writes one Inspect log for each subject model of our Workspace Probe Swap run, so that the runner
can import it as a run of version 2026-11: data/cache/workspace-lens-probe-swap/logs/<model>.eval.

Reads the files that data/scripts/rlens-fit/probe_swap.py writes, in
data/cache/workspace-lens-probe-swap/<model>/, and the harness's items (probe-swap-items.json).
Each item is one sample: the prompt, the two swaps as the target, and the model's own top word as
the reply. Each lens has one score, 1 or 0: the swap made the new answer the top word, at the
lens's best scale for this model. An item has scores only when the model's own top word is the
answer. Each lens also has `<lens>/<metric>` scores, one for each other metric of the version.
The sample metadata has every lens, scale and control trial (`probeSwap`).
Uses the runner's Inspect version:
  cd apps/runner && uv run --with pandas --with pyarrow python ../../data/scripts/workspace-probe-swap-logs.py
Then import each log:
  uv run openaudit-runner import <log> --model <subject> --eval workspace-probe-swap
"""

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent / "rlens-fit"))
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
from strip_rule import is_number

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "workspace-lens-probe-swap"
TASK = "openaudit_runner/workspace_probe_swap"
JPP_REPO = "safety-research/jpp_lens"
JPP_COMMIT = "d7efc0de372e20589e899188c0cfe8434acc63ec"
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
VARIANTS = {"main": "main", "answer_swap": "answerSwap", "random_null": "randomNull"}
# The seed metric key of each variant: `<prefix>` at the best scale, `<prefix>_scale_<s>` at each.
PREFIXES = {"main": "swap_top1", "answer_swap": "answer_swap_top1", "random_null": "random_swap_top1"}
TOP = 5
NOTE = (
    "OpenAudit ran this on {gpu} with the jpp_lens harness (commit {commit}). {lenses} The swap "
    "edits the seven readout layers at the scales {scales}. A lens's score on a sample is at its "
    "best scale for this model ({best}), as in the paper. A sample has scores only when the "
    "model's own top word is the answer.{space}"
)
SPACE = (
    " A prompt that ends in a space is read without it, at the token before the answer. A number "
    "answer keeps the space, because the tokenizer splits it from the number."
)
NP_LENSES = (
    "The J-Lens and the J++ Lens are the Neuronpedia files; the R-Lens is our fit on 64 "
    "WikiText-103 prompts."
)
CB_JLENS = (
    "The J++ Lens is the Neuronpedia file; the J-Lens is Camila Blank's fit on 25 Pile prompts; "
    "the R-Lens is our fit on 64 WikiText-103 prompts."
)
LENS_TEXT = {"Qwen/Qwen3.5-9B": CB_JLENS, "Qwen/Qwen3.5-122B-A10B": CB_JLENS}
NAMES = {
    "r_lens": "R-Lens",
    "jacobian_lens": "J-Lens",
    "jpp_lens": "J++ Lens",
    "logit_lens": "logit lens",
}
WHY_NOT = {
    "token": "A swap word is not one token for this model, so the harness has no trial.",
    "wrong": "The model's output `{reply}` wasn't our expected `{answer}`.",
}


def lens_key(name: str) -> str:
    return next(key for end, key in LENS_KEYS if name.endswith(end))


def gpu_text(gpus: list[str]) -> str:
    n = len(gpus)
    name = gpus[0].removeprefix("NVIDIA ") if gpus else "a GPU"
    return f"one {name}" if n == 1 else f"{['', '', 'two', 'three', 'four'][n] or n} {name}s"


def words(cell: str | None) -> list[str]:
    return json.loads(cell)[:TOP] if isinstance(cell, str) else []


def best_scales(trials: pd.DataFrame) -> dict[str, float]:
    """Each lens's scale with the most top-1 swaps over the counted main trials (ties go to the
    smaller scale), as `probe_swap.best_scale_rows`."""
    main = trials[(trials["variant"] == "main") & (trials["clean_baseline_word_rank"] == 1)]
    hits = (
        main.assign(hit=main["success_word_rank"] <= 1)
        .groupby(["lens", "scale"])["hit"]
        .mean()
        .reset_index()
        .sort_values(["lens", "hit", "scale"], ascending=[True, False, True])
    )
    return dict(hits.drop_duplicates("lens")[["lens", "scale"]].itertuples(index=False))


def build(folder: Path, items: dict[str, dict]) -> tuple[Path, dict[str, float]]:
    slug = folder.glob("*_probe_swap_header.json").__next__().name.removesuffix(
        "_probe_swap_header.json"
    )
    header = json.loads((folder / f"{slug}_probe_swap_header.json").read_text())
    trials = pd.read_parquet(folder / f"{slug}_probe_swap_trials.parquet")
    subject = header["model"]
    model = f"hf/{subject}"
    keys = {name: lens_key(name) for name in header["lenses"]}
    best = {keys[n]: s for n, s in best_scales(trials).items()}
    files = {keys[n]: Path(f).name for n, f in header["lenses"].items() if f != "logit"}
    when = datetime.fromtimestamp(
        (folder / f"{slug}_probe_swap_header.json").stat().st_mtime, UTC
    ).isoformat()
    strip = header.get("strip_word_answers", False)
    hits: dict[str, list[int]] = {k: [] for k in keys.values()}
    by_item = dict(iter(trials.groupby("item")))
    samples = []
    for name, item in items.items():
        prompt = item["prompt"]
        if strip and not is_number(item["answer"]):
            prompt = prompt.rstrip()
        rows = by_item.get(name)
        main = rows[rows["variant"] == "main"] if rows is not None else None
        clean = main.iloc[0] if main is not None and len(main) else None
        reply = words(clean["clean_top_word_tokens"])[0].strip() if clean is not None else ""
        why = "token" if clean is None else None if clean["clean_baseline_word_rank"] == 1 else "wrong"
        scores = {}
        runs: dict[str, dict] = {}
        for r in rows.itertuples() if rows is not None else []:
            key = keys[r.lens]
            runs.setdefault(VARIANTS[r.variant], {}).setdefault(key, []).append(
                {
                    "scale": r.scale,
                    "rank": int(r.success_word_rank),
                    "answerRank": int(r.baseline_word_rank),
                    "top": words(r.swapped_top_word_tokens),
                    "editNorm": round(float(r.edit_norm_ratio), 4),
                    **({"to": r.target_surface.strip()} if r.variant == "random_null" else {}),
                }
            )
            if why:
                continue
            hit = int(r.success_word_rank <= 1)
            prefix = PREFIXES[r.variant]
            scale = f"{r.scale:g}".replace(".", "_")
            scores[f"{key}/{prefix}_scale_{scale}"] = Score(value=hit)
            if r.scale != best.get(key):
                continue
            if r.variant != "main":
                scores[f"{key}/{prefix}"] = Score(value=hit)
                continue
            # Top-5 counts only the trials where the new answer is not in the top five before.
            if r.clean_success_word_rank > TOP:
                scores[f"{key}/swap_top5"] = Score(value=int(r.success_word_rank <= TOP))
            hits[key].append(hit)
            top = ", ".join(words(r.swapped_top_word_tokens)[:3])
            scores[key] = Score(
                value=hit,
                explanation=(
                    f"At scale {r.scale:g}, {item['swap_answer']} is the word at rank "
                    f"{r.success_word_rank} after the swap. Top words: {top}."
                ),
            )
        metadata = {
            "category": item["category"],
            "scored": not why,
            **({"notScored": WHY_NOT[why].format(reply=reply, answer=item["answer"])} if why else {}),
            "probeSwap": {
                "layers": header["layers"],
                "scales": header["scales"],
                "bestScale": best,
                "intermediate": item["intermediate"],
                "swapTo": item["swap_to"],
                "answer": item["answer"],
                "swapAnswer": item["swap_answer"],
                **(
                    {
                        "cleanTop": words(clean["clean_top_word_tokens"]),
                        "cleanAnswerRank": int(clean["clean_baseline_word_rank"]),
                        "cleanSwapRank": int(clean["clean_success_word_rank"]),
                    }
                    if clean is not None
                    else {}
                ),
                "trials": runs,
            },
        }
        samples.append(
            EvalSample(
                id=name,
                epoch=1,
                input=prompt,
                target=[
                    f"{item['intermediate']} → {item['swap_to']}",
                    f"{item['answer']} → {item['swap_answer']}",
                ],
                messages=[
                    ChatMessageUser(content=prompt),
                    ChatMessageAssistant(content=reply, model=model),
                ],
                output=ModelOutput.from_content(model=model, content=reply),
                scores=scores,
                metadata=metadata,
            )
        )
    rates = {k: round(sum(v) / len(v), 4) for k, v in hits.items() if v}
    log = EvalLog(
        status="success",
        eval=EvalSpec(
            created=when,
            task=TASK,
            task_args={"layers": header["layers"], "scales": header["scales"]},
            dataset=EvalDataset(
                name=JPP_REPO,
                location=(
                    f"https://github.com/{JPP_REPO}/blob/{JPP_COMMIT}/data/jlens/experiments/"
                    "probe-swap.json"
                ),
                samples=len(samples),
                sample_ids=[s.id for s in samples],
                shuffled=False,
            ),
            model=model,
            config=EvalConfig(),
            packages={"inspect_ai": inspect_version},
            metadata={
                "source": f"https://github.com/{JPP_REPO}",
                "lenses": files,
                "note": NOTE.format(
                    gpu=gpu_text(header["gpus"]),
                    commit=JPP_COMMIT[:8],
                    lenses=LENS_TEXT.get(subject, NP_LENSES),
                    scales=", ".join(f"{s:g}" for s in header["scales"]),
                    best="; ".join(f"{NAMES[k]} {s:g}" for k, s in sorted(best.items())),
                    space=SPACE if strip else "",
                ),
            },
        ),
        stats=EvalStats(started_at=when, completed_at=when),
        samples=samples,
    )
    out = CACHE / "logs" / f"{subject.replace('/', '-')}.eval"
    out.parent.mkdir(parents=True, exist_ok=True)
    write_eval_log(log, str(out), format="eval")
    return out, rates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="Model folders, separated by commas (default: all).")
    args = ap.parse_args()
    items = {
        i["name"]: i
        for i in json.loads((CACHE / "probe-swap-items.json").read_text())["items"]
    }
    folders = sorted(
        p.parent for p in CACHE.glob("*/*_probe_swap_header.json") if "-cb-" not in p.parent.name
    )
    if args.only:
        folders = [f for f in folders if f.name in args.only.split(",")]
    for f in folders:
        out, rates = build(f, items)
        print(f"{f.name}: swap top-1 {rates} -> {out} ({out.stat().st_size >> 10} KB)", flush=True)


if __name__ == "__main__":
    main()
