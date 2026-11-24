"""Writes one Inspect log of a fast WorkspaceBench run on Qwen3.6-27B (version 6be6304-fast-safety
and later), so that the runner can import it: <run>/export/Qwen-Qwen3.6-27B.eval.

Reads <run>/export/, which evals/workspacebench/export.py writes from the run folder.
Each read item is one sample: the prompt, the gold answer as the target, and one score for each lens
(1 when the lens passes the item's unit). An item that shares its unit with a scored item (a clean
twin, a control prompt, the second order of a story) has no score. The sample metadata has the
cells that the judge read for each lens, the judge's verdict and the summarizer's notes
(`wsbReadout`), and the family's settings (`openauditSettings`). A nocot item has a note in place
of its question.
Uses the runner's Inspect version:
  cd apps/runner && uv run python ../../data/scripts/workspacebench-fast-logs.py --run <run>
Then import the log:
  uv run openaudit-runner import <log> --model Qwen/Qwen3.6-27B --eval workspacebench
"""

import argparse
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
from inspect_ai.model import (
    ChatMessageAssistant,
    ChatMessageSystem,
    ChatMessageUser,
    ModelOutput,
)
from inspect_ai.scorer import Score

SUBJECT = "Qwen/Qwen3.6-27B"
TASK = "openaudit_runner/workspacebench"
REPO = "camilablank/workspace-bench"
AUTHOR_READOUTS = "https://huggingface.co/datasets/camila-blank/workspace-bench-fast-v2"
AUTHOR = "Camila Blank"
MODEL_NAMES = {
    "claude-opus-5-5": "Claude Opus 5.5",
    "claude-sonnet-5": "Claude Sonnet 5",
    "openai/gpt-6-luna": "GPT-6 Luna",
}
# The summarizer when the family's opts name none (upstream `digest.DEFAULT_MODEL`).
DEFAULT_SUMMARIZER = "claude-opus-5-5"
ROUTES = {"anthropic-batch": "Batch API"}
NOTE = (
    "OpenAudit ran this on Qwen3.6-27B with the WorkspaceBench harness (commit {commit}) and "
    "OpenAudit's patch, on the fast subset {subset}. The judge digests the readouts of each "
    "question with a summarizer (GPT-6 Luna; Claude Opus 5.5 for introspection and the two regex "
    "families), then the family's judge (Batch API) reads the digest: Claude Opus 5.5, or Claude "
    "Sonnet 5 for the two safety families. The J-Lens readouts of {n_jlens} "
    "families and the Oracle Lens readouts of {n_olens} families are Camila Blank's ({author}), "
    "with her permission; OpenAudit made the others."
)
# export.py keeps only the id and the results of a nocot item.
PRIVATE = (
    "This question is from nocot-bench, which asks that its questions are not republished. "
    "OpenAudit does not show the question, its answer options or the readouts."
)


def messages(p: dict, model: str) -> list:
    """The chat turns of a read item's prompt."""
    out: list = []
    if p.get("system"):
        out.append(ChatMessageSystem(content=p["system"]))
    for m in p.get("messages") or []:
        cls = {"system": ChatMessageSystem, "assistant": ChatMessageAssistant}.get(
            m["role"], ChatMessageUser
        )
        out.append(
            cls(
                content=m["content"],
                **({"model": model} if cls is ChatMessageAssistant else {}),
            )
        )
    if p.get("text") and not p.get("messages"):
        out.append(ChatMessageUser(content=p["text"]))
    reply = p.get("assistant") or p.get("prefill")
    if reply:
        out.append(ChatMessageAssistant(content=reply, model=model))
    return out


def input_text(p: dict) -> str:
    if p.get("text") and not p.get("messages"):
        return p["text"]
    return "\n\n".join(f"{m['role']}: {m['content']}" for m in p.get("messages") or [])


def sources(results: dict) -> dict[str, list[str]]:
    """Score key -> the families whose readouts came from the author's dataset."""
    out: dict[str, list[str]] = {}
    for key, res in results.items():
        run = next(iter(res["runs"].values()))
        out[key] = sorted(
            f
            for f, s in (run.get("readoutSources") or {}).items()
            if AUTHOR_READOUTS in str(s.get("source"))
        )
    return out


def model_ref(name: str) -> dict:
    return {"model": name, "name": MODEL_NAMES.get(name, name)}


def settings(results: dict, fam: str) -> dict:
    """The family's judge, summarizer and metric, and whose readouts each lens has."""
    out: dict = {"readouts": {}}
    for key, res in results.items():
        run = next(iter(res["runs"].values()))
        d = run["evals"]["workspacebench"]["families"].get(fam)
        if not d:
            continue
        opts = dict(
            kv.split("=", 1) for kv in (d.get("opts") or "").split(",") if "=" in kv
        )
        out |= {
            "judge": model_ref(d["judgeModel"]),
            "summarizer": model_ref(opts.get("summ_model", DEFAULT_SUMMARIZER)),
            "metric": d["metric"],
            **(
                {"route": r}
                if (r := ROUTES.get(run["instrument"].get("judgeRoute")))
                else {}
            ),
        }
        src = str(((run.get("readoutSources") or {}).get(fam) or {}).get("source", ""))
        out["readouts"][key] = (
            {"by": AUTHOR, "url": AUTHOR_READOUTS}
            if AUTHOR_READOUTS in src
            else {"by": "OpenAudit"}
        )
    return out


def build(run_dir: Path) -> Path:
    exp = run_dir / "export"
    meta = json.loads((exp / "run.json").read_text())
    model = f"hf/{SUBJECT}"
    samples = []
    families = sorted(meta["families"])
    for fam in families:
        fam_settings = settings(meta["results"], fam)
        n_scored: dict[str, list[int]] = {}
        for line in (exp / f"{fam}.jsonl").read_text().splitlines():
            it = json.loads(line)
            lenses = it["lenses"]
            if not lenses:
                continue
            scores = {}
            for key, lens in lenses.items():
                v = lens["verdict"]
                if v.get("pass") is not None:
                    scores[key] = Score(
                        value=int(v["pass"]), explanation=v.get("pick") or None
                    )
                    n_scored.setdefault(key, []).append(int(v["pass"]))
            first = next(iter(lenses.values()))["verdict"]
            gold, options = first.get("gold"), first.get("options")
            not_scored = None
            if not it["scored"]:
                not_scored = (
                    f"Scored with {it['scoredWith']}: the family scores the two items as one question."
                    if it.get("scoredWith")
                    else "The fast subset does not score this item."
                )
            elif not scores:
                not_scored = (
                    "The judge gave no outcome for this question, so it has no score."
                )
            p = it["prompt"]
            private = bool(p.get("redacted"))
            if private:
                p = {"text": PRIVATE}
            samples.append(
                EvalSample(
                    id=f"{fam}/{it['id']}",
                    epoch=1,
                    input=input_text(p),
                    target=gold or "",
                    messages=messages(p, model),
                    output=ModelOutput.from_content(
                        model=model, content=p.get("assistant") or ""
                    ),
                    scores=scores,
                    metadata={
                        "family": fam,
                        "scored": bool(scores),
                        **({"notScored": not_scored} if not_scored else {}),
                        "openauditSettings": fam_settings,
                        "wsbReadout": {
                            "family": fam,
                            **({"redacted": "nocot"} if private else {}),
                            **({"regex": True} if it.get("regex") else {}),
                            **({"options": options} if options else {}),
                            **({"gold": gold} if gold else {}),
                            "lenses": {
                                k: {
                                    **lens,
                                    "verdict": {
                                        x: y
                                        for x, y in lens["verdict"].items()
                                        if x not in ("gold", "options")
                                    },
                                }
                                for k, lens in lenses.items()
                            },
                        },
                    },
                )
            )
        for key, vals in n_scored.items():
            want = meta["families"][fam].get(key, {}).get("value")
            print(
                f"{fam:36} {key:14} n={len(vals):3} pass={sum(vals) / len(vals):.3f} (family value {want})"
            )
    run0 = next(iter(next(iter(meta["results"].values()))["runs"].values()))
    by_lens = sources(meta["results"])
    when = datetime.now(UTC).isoformat()
    log = EvalLog(
        status="success",
        eval=EvalSpec(
            created=when,
            task=TASK,
            task_args={"families": families, "version": meta["version"]},
            dataset=EvalDataset(
                name=REPO,
                location=f"https://github.com/{REPO}/tree/{run0['harness']['workspaceBench']}/evals",
                samples=len(samples),
                sample_ids=[s.id for s in samples],
                shuffled=False,
            ),
            model=model,
            config=EvalConfig(),
            packages={"inspect_ai": inspect_version},
            metadata={
                "source": f"https://github.com/{REPO}",
                "version": meta["version"],
                "authorReadouts": {"url": AUTHOR_READOUTS, "families": by_lens},
                "note": NOTE.format(
                    commit=run0["harness"]["workspaceBench"][:7],
                    subset=run0["instrument"]["fastSubset"],
                    n_jlens=len(by_lens.get("jacobian_lens", [])),
                    n_olens=len(by_lens.get("oracle_lens", [])),
                    author=AUTHOR_READOUTS,
                ),
            },
        ),
        stats=EvalStats(started_at=when, completed_at=when),
        samples=samples,
    )
    out = exp / f"{SUBJECT.replace('/', '-')}.eval"
    write_eval_log(log, str(out), format="eval")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--run", type=Path, required=True, help="The run folder (with export/)."
    )
    path = build(ap.parse_args().run)
    print(f"-> {path} ({path.stat().st_size >> 10} KB)")
