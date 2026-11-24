"""Writes one Inspect log of our WorkspaceBench run on Qwen3.6-27B, so that the runner can import it
as a run of version 2026-11: data/cache/workspacebench/logs/Qwen-Qwen3.6-27B.eval.

Reads data/cache/workspacebench/ (copied from the run folder):
  plan/<family>.jsonl                   the read plan of the harness (the prompt of each question)
  readouts/<lens>/<family>.jsonl        the readout of each cell (layer, position)
  judge/<lens>/<family>/results.json    the judge's results (`wsbench judge`)
  items/<family>.json                   the bank's facts of each question: the target, the options
                                        or the forms that each regex unit accepts, and the gold's
                                        aliases
Each question is one sample: the prompt, the gold answer as the target, and one score for each lens
(1 when the lens passes the question under its family's rule). The sample metadata has the read grid
of each lens and its verdict (`wsbReadout`). For each family and lens, the mean of the scores must
equal the harness's own family score, else the script stops.
Uses the runner's Inspect version:
  cd apps/runner && uv run python ../../data/scripts/workspacebench-logs.py
Then import the log:
  uv run openaudit-runner import <log> --model Qwen/Qwen3.6-27B --eval workspacebench --visibility unlisted
"""

import argparse
import json
import re
import unicodedata
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

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
CACHE = ROOT / "data" / "cache" / "workspacebench"
SUBJECT = "Qwen/Qwen3.6-27B"
TASK = "openaudit_runner/workspacebench"
REPO = "camilablank/workspace-bench"
COMMIT = "2617613910e727fc31615a1193044c6cc729ad87"
# The harness's name of each lens, and its score key.
LENSES = {"jlens": "jacobian_lens", "jpp": "jpp_lens", "olens": "oracle_lens"}
FAMILIES = [
    "multihop",
    "multilingual_multihop",
    "relational_multihop",
    "poetry",
    "directed_modulation",
    "model_specific_directed_modulation",
    "multilingual_mt",
    "typo_mt",
    "multilingual_typo",
    "buggy_code",
]
# The families with no judge: a regex reads the readouts.
REGEX = {
    "model_specific_directed_modulation",
    "multilingual_mt",
    "typo_mt",
    "multilingual_typo",
}
# A text lens writes long samples; the view needs only the start of each.
MAX_TEXT = 600
NOTE = (
    "OpenAudit ran this on Qwen3.6-27B with the WorkspaceBench harness (commit {commit}) and "
    "OpenAudit's patch. The readouts are of all positions of each family's read plan, at layers 20 "
    "to 60. A Claude Opus 5.5 judge (Batch API) reads all readout lines of a question in one call; "
    "four families use a regex and no judge. The J-Lens and the J++ Lens are the Neuronpedia files; "
    "the J++ Lens uses its authors' readout, W_U · norm(J·h). The Oracle Lens is agu18dec/olens_and_ar "
    "(olens_s3d_rl600), one sample for each cell."
)


def _bytes_to_unicode() -> dict[int, str]:
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1))
    bs += list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return {b: chr(c) for b, c in zip(bs, cs, strict=True)}


_U2B = {c: b for b, c in _bytes_to_unicode().items()}


def decode(tok: str) -> str:
    """A byte-level BPE token as text, as the harness decodes it (wsbench.bpe.decode_token)."""
    tok = tok.replace("▁", " ")
    raw = b"".join(bytes([_U2B[c]]) if c in _U2B else c.encode() for c in tok)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = None
    if text is None or any(
        (ord(c) < 0x20 and c not in "\n\t\r\x0b\x0c") or 0x7F <= ord(c) <= 0x9F
        for c in text
    ):
        return tok.replace("Ġ", " ").replace("Ċ", "\n")
    return text


def option_at(options: list | None, i: Any, base: int) -> str | None:
    """The option at index `i` (`base` 0 or 1), or at a letter (A is the first)."""
    if not options or i is None or isinstance(i, bool):
        return None
    if isinstance(i, str):
        if len(i) == 1 and i.isalpha():
            i, base = ord(i.upper()) - ord("A"), 0
        else:
            return None
    k = int(i) - base
    return str(options[k]) if 0 <= k < len(options) else None


def claim(c: str | None) -> str:
    """The judge's buggy_code claim ("bug" or "none") as the view shows it."""
    return "bug" if c == "bug" else "no bug"


_CJK = re.compile(
    r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]"
)


def fold(s: str) -> str:
    """Text with no accents or case, as the harness compares it (`mc.fold`)."""
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).casefold()


def named_form(text: str, forms: list[str]) -> str | None:
    """The first form that `text` has: a CJK form anywhere, any other between word boundaries."""
    t = fold(text)
    for f in forms:
        ff = fold(f).strip()
        if ff and (
            ff in t
            if _CJK.search(ff)
            else re.search(rf"(?<![^\W_]){re.escape(ff)}(?![^\W_])", t)
        ):
            return f
    return None


def why_multihop(r: dict, gold: str, pick: str | None, forms: list[str]) -> str:
    """Why a multihop pick passes or fails (`mcjudge_bank.verdict`)."""
    kind = r.get("choice_kind")
    if kind is None:
        return "The judge gave no answer, so the question has no score."
    if kind == "cannot_tell":
        return "The judge said that the readout cannot tell."
    if kind != "gold":
        return f"The judge picked {pick}, not {gold}."
    quote = r.get("quote") or ""
    fails = []
    if not (r.get("quote_ok") or r.get("quote_near")):
        fails.append("The quote is not in the readout.")
    elif not r.get("form_ok"):
        fails.append(f"The quote does not name {gold} or one of its forms.")
    if r.get("names_other"):
        fails.append("The quote also names another option.")
    if r.get("number_flood"):
        fails.append(
            "Each line with the quote is a run of numbers, so it singles out no number."
        )
    if r.get("multi_option"):
        fails.append(
            "Each line with the quote is a token list that also holds another option, so it "
            "singles out none."
        )
    if r.get("element_index"):
        fails.append(
            f"The quote gives {gold} only as an atomic number or a periodic-table place."
        )
    if fails:
        return " ".join([f"The judge picked {gold}.", *fails])
    form = named_form(quote.replace("|", " "), forms)
    as_form = f" (as {form})" if form and fold(form) != fold(gold) else ""
    where = "near-verbatim in" if r.get("quote_near") else "in"
    how = {
        "block": f"The readout's words where it matches name {gold}.",
        "line": f"Its line continues it into {gold}.",
    }.get(r.get("form_via") or "", f"It names {gold}{as_form}.")
    return f"The judge picked {gold}. Its quote is {where} the readout. {how} It names no other option."


POETRY = {
    "correct": "The judge named {gold} as the last word of line two. Its quote is in the readout "
    "and ends with {gold}.",
    "other_word": "The judge named {word}, not {gold}.",
    "line_one_word": "The judge named line one's own last word, {first}, and no other word.",
    "none": "The judge found no word that ends line two.",
    "invalid": "The judge's answer is not one word.",
    "quote_failed": "The judge named {gold}, but its quote is not in the readout.",
    "wrong_form": "The judge named {gold}, but its quote does not end with {gold}.",
    "not_line_final": "The judge named {gold}, but no sample has {gold} at the end of a line.",
    "empty": "The lens gave nothing to read.",
}


def why_poetry(r: dict, gold: str) -> str | None:
    """Why a poetry answer passes or fails (`poetry.judge.free_verdict`)."""
    text = POETRY.get(str(r.get("kind")))
    if text is None:
        return None
    first = r.get("line_one_answer") or ""
    out = text.format(gold=gold, word=r.get("word") or "", first=first)
    if r.get("via") == "runner_up" and r.get("kind") != "line_one_word":
        out = (
            f"The judge first named line one's own last word, {first}, so its second word "
            f"counts. {out}"
        )
    if r.get("gate_via") == "other_sample":
        out += (
            " The quoted sample does not end the line there, but another sample does."
        )
    return out


RELATIONAL_GATE = {
    "pass": "Its quote is one phrase in one statement, and states the chain in order.",
    "order": "But no statement with the quote states the chain in this order.",
    "two_chains": "But each statement with the quote also states another chain, so it "
    "singles out none.",
    "quote_rejected": "But its quote is not in the readout.",
    "unverified_bullet": "But its quote is not inside one statement.",
    "too_long": "But its quote is longer than 15 words (40 CJK characters).",
}


def why_relational(r: dict, gold: str, pick: str | None) -> str | None:
    """Why a relational pick passes or fails (`relational_multihop.judge.evaluate`)."""
    cls = r.get("pick_class")
    if cls == "cannot_tell":
        return "The judge said that the readout cannot tell."
    if cls == "invalid":
        return "The judge's answer is not an option."
    if cls == "gold":
        return (
            f"The judge picked {gold}. {RELATIONAL_GATE.get(r.get('gate'), '')}".strip()
        )
    if cls == "reversed":
        return f"The judge picked {pick}: the two relations in the wrong order."
    if cls == "one_relation":
        return f"The judge picked {pick}: only one of the two relations."
    return f"The judge picked {pick}, not {gold}."


BASIS = {
    "content_bound": "as content (facts, images or a story about it)",
    "instruction_narration": "only as narration of the instruction",
    "incidental": "only in a generic list or template",
}
FORM = {
    "exact": "by its word",
    "synonym": "by a synonym",
    "description": "by a description",
    "variant": "by a variant of its word",
    "translation": "by a translation",
}


def why_modulation(r: dict, gold: str) -> str | None:
    """Why a directed-modulation pick passes or fails (`directed_modulation.judge`)."""
    if not r.get("judged"):
        return None
    if r.get("voided"):
        return "The judge picked an option, but its evidence is not in the readout, so the pick does not count."
    pick = r.get("pick")
    if pick == "cannot_tell":
        return "The judge said that the readout cannot tell."
    if pick != "gold":
        return f"The judge picked another concept, not {gold}."
    basis = BASIS.get(r.get("basis") or "")
    form = FORM.get(r.get("form") or "")
    out = f"The judge picked {gold}. Its evidence is in the readout."
    if form:
        out += f" It names the concept {form}"
        out += f", {basis}." if basis else "."
    elif basis:
        out += f" It has the concept {basis}."
    return out


CLAIM = {
    "bug": "a bug",
    "correct": "that the program works",
    "none": "nothing about how the program works",
}


def why_buggy(r: dict) -> str | None:
    """What the blind reader and the grader said (`buggy_code.judge`)."""
    c = r.get("claim")
    if c not in CLAIM:
        return None
    votes = r.get("votes") or []
    out = f"The reader says that the readouts claim {CLAIM[c]}"
    out += f" (votes: {', '.join(votes)})." if votes else "."
    if c != "none" and r.get("inferred"):
        out += f" Its reading: {r['inferred'].strip()}"
        if not out.endswith((".", "!", "?")):
            out += "."
    if c == "bug" and r.get("score") is not None:
        out += f" The grader gives it {r['score']}/10."
    return out


def why_roles(r: dict, mc: list[dict]) -> str:
    """Why a multilingual-multihop question passes or fails (`multitoken.mcrx`)."""
    out = []
    for m in mc:
        role = "bridge" if m["role"] == "bridge_native" else m["role"].replace("_", " ")
        gold = m.get("gold")
        kind = m.get("kind")
        if kind == "cannot":
            out.append(f"For the {role}, the judge said that the readout cannot tell.")
        elif kind == "distractor":
            out.append(f"For the {role}, the judge picked another option, not {gold}.")
        elif kind == "correct" and m.get("correct"):
            out.append(
                f"For the {role}, the judge picked {gold}, and its quote names it."
            )
        elif kind == "correct" and not (m.get("quote_ok") or m.get("quote_near")):
            out.append(
                f"For the {role}, the judge picked {gold}, but its quote is not in the readout."
            )
        elif kind == "correct":
            out.append(
                f"For the {role}, the judge picked {gold}, but its quote does not name it."
            )
    if "regex_pass" in r:
        out.append(
            "The regex finds the bridge in one layer's readouts."
            if r["regex_pass"]
            else "The regex does not find the bridge in any one layer's readouts."
        )
    if "language_pass" in r:
        out.append(
            "A readout names the language."
            if r["language_pass"]
            else "No readout names the language."
        )
    return " ".join(out)


def verdicts(fam: str, res: dict, facts: dict[str, dict]) -> dict[str, dict]:
    """Question id -> verdict: `pass` (None: not scored) and what the view shows (the options,
    the gold, the pick, the quote, the regex hits). `facts`: the bank's facts of each question,
    for the options and the gold that the judge rows do not have."""
    extras = (res.get("numbers") or {}).get("extras") or {}
    out: dict[str, dict] = {}
    if fam == "buggy_code":
        claims = {r["id"]: r for r in res.get("rows") or []}
        for p in extras.get("pairs") or []:
            b, c = claims.get(p["buggy"], {}), claims.get(p["clean"], {})
            bc, cc = claim(p.get("buggy_claim")), claim(p.get("clean_claim"))
            out[p["buggy"]] = {
                "pass": bool(p["pair_hit"]),
                "gold": "bug",
                "pick": bc,
                "quote": b.get("quote") or None,
                "why": why_buggy(b),
                "note": f"Passes when the lens finds the bug here and no bug in the twin "
                f"{p['clean']} (claim there: {cc}).",
            }
            out[p["clean"]] = {
                "pass": None,
                "gold": "no bug",
                "pick": cc,
                "quote": c.get("quote") or None,
                "why": why_buggy(c),
                "note": f"Scored with its buggy twin {p['buggy']} (claim there: {bc}).",
            }
        return out
    rows: dict[str, list[dict]] = defaultdict(list)
    for r in res.get("rows") or []:
        rid = r.get("item") if fam == "directed_modulation" else r.get("id")
        if rid is not None:
            rows[str(rid)].append(r)
    for rid, rs in rows.items():
        r = rs[-1]
        if fam == "directed_modulation":
            ok = (r.get("pick") == "gold") if r.get("judged") else None
        else:
            vals = [x.get("pass", x.get("correct")) for x in rs]
            vals = [v for v in vals if v is not None]
            ok = None if not vals else all(bool(v) for v in vals)
        f = facts.get(rid) or {}
        options = r.get("options") or f.get("options")
        gold = r.get("gold") or f.get("gold")
        if gold is None:
            for key, base in (("gold_idx", 0), ("gold_position", 1), ("gold_pos", 1)):
                if r.get(key) is not None:
                    gold = option_at(options, r[key], base)
                    break
        # `pick` is a label in some families: "gold", "other" (then `word`), "none", "cannot_tell".
        pick = option_at(options, r.get("choice"), 1) or r.get("word") or r.get("pick")
        if pick == "gold":
            pick = gold
        elif isinstance(pick, str):
            pick = pick.replace("_", " ")
        units = r.get("unit_hit") or r.get("unit_correct") or r.get("option_any_hit")
        quote = r.get("quote") or r.get("evidence") or None
        mc = (
            [m for m in (r.get("mc") or {}).values()]
            if isinstance(r.get("mc"), dict)
            else []
        )
        mc = [m for m in mc if isinstance(m, dict) and "role" in m]
        why = None
        if mc:
            # The judge picks each role's option; the language comes from the readouts.
            units = {f"{m['role']} (judge)": bool(m.get("correct")) for m in mc}
            if "language_pass" in r:
                units["language"] = bool(r["language_pass"])
            gold = gold or mc[0].get("gold")
            kind = str(mc[0].get("kind") or "")
            pick = {
                "correct": gold,
                "cannot": "cannot tell",
                "distractor": "another option",
            }.get(kind, kind)
            quote = mc[0].get("quote") or None
            why = why_roles(r, mc)
        elif fam == "multihop":
            why = why_multihop(
                r, str(gold), pick, [str(gold), *(f.get("aliases") or [])]
            )
        elif fam == "poetry":
            why = why_poetry(r, str(gold))
        elif fam == "relational_multihop":
            why = why_relational(r, str(gold), pick)
        elif fam == "directed_modulation":
            why = why_modulation(r, str(gold))
        out[rid] = {
            "pass": ok,
            "options": [str(o) for o in options] if options else None,
            "gold": str(gold) if gold is not None else None,
            "pick": str(pick) if pick else None,
            "quote": quote,
            "units": units if isinstance(units, dict) else None,
            "why": why or None,
        }
    return out


def grid(rows: list[dict], text: bool) -> dict:
    """The cells of one question: `cells[layer][position]`, the top tokens or the text samples."""
    layers = sorted({r["layer"] for r in rows})
    positions = sorted({r["pos"] for r in rows})
    token = {r["pos"]: decode(r.get("token") or "") for r in rows}
    li, pi = (
        {x: i for i, x in enumerate(layers)},
        {x: i for i, x in enumerate(positions)},
    )
    cells: list[list[list[str] | None]] = [[None] * len(positions) for _ in layers]
    for r in rows:
        if text:
            v = [s[:MAX_TEXT] for s in r.get("samples") or []]
        else:
            v = [decode(t) for t in r.get("tokens") or []]
        cells[li[r["layer"]]][pi[r["pos"]]] = v
    return {
        "layers": layers,
        "positions": [{"pos": p, "token": token[p]} for p in positions],
        "cells": cells,
    }


def read_jsonl(path: Path) -> list[dict]:
    with path.open() as f:
        return [json.loads(line) for line in f if line.strip()]


def build() -> Path:
    model = f"hf/{SUBJECT}"
    samples = []
    checks = []
    for fam in FAMILIES:
        plan = {r["id"]: r for r in read_jsonl(CACHE / "plan" / f"{fam}.jsonl")}
        facts = json.loads((CACHE / "items" / f"{fam}.json").read_text())
        by_lens: dict[str, tuple[dict, dict, bool]] = {}
        for lens, key in LENSES.items():
            res_path = CACHE / "judge" / lens / fam / "results.json"
            ro_path = CACHE / "readouts" / lens / f"{fam}.jsonl"
            if not res_path.exists() or not ro_path.exists():
                continue
            res = json.loads(res_path.read_text())
            v = verdicts(fam, res, facts)
            scored = [x["pass"] for x in v.values() if x["pass"] is not None]
            mean = sum(scored) / len(scored) if scored else 0.0
            want = (res.get("numbers") or {}).get("value")
            checks.append((fam, key, len(scored), mean, want))
            if want is None or abs(mean - want) > 1e-9:
                raise SystemExit(
                    f"{fam} {key}: mean of verdicts {mean} != harness score {want}"
                )
            cells: dict[str, list[dict]] = defaultdict(list)
            for r in read_jsonl(ro_path):
                cells[r["id"]].append(r)
            text = "samples" in next(iter(cells.values()))[0]
            by_lens[key] = (v, cells, text)
        ids = [i for i in plan if any(i in v for v, _, _ in by_lens.values())]
        for qid in ids:
            p = plan[qid]
            lenses, scores = {}, {}
            first: dict = {}
            for key, (v, cells, text) in by_lens.items():
                verdict = v.get(qid)
                if verdict is None or qid not in cells:
                    continue
                first = first or verdict
                lenses[key] = {
                    "kind": "text" if text else "tokens",
                    **grid(cells[qid], text),
                    "verdict": {
                        k: x
                        for k, x in verdict.items()
                        if x is not None and k not in ("options", "gold")
                    },
                }
                if verdict["pass"] is not None:
                    scores[key] = Score(
                        value=int(verdict["pass"]),
                        explanation=verdict.get("pick") or verdict.get("note"),
                    )
            fact = facts.get(qid) or {}
            gold = first.get("gold")
            options = first.get("options")
            aliases = fact.get("aliases") if gold and fact.get("gold") == gold else None
            not_scored = None
            if not scores and fam == "buggy_code":
                not_scored = "A bug-free twin: each lens is scored on its buggy twin, for both files."
            reply = p.get("assistant") or ""
            messages: list = [ChatMessageUser(content=p["text"])]
            if reply:
                messages.append(ChatMessageAssistant(content=reply, model=model))
            samples.append(
                EvalSample(
                    id=f"{fam}/{qid}",
                    epoch=1,
                    input=p["text"],
                    target=gold or fact.get("target") or "",
                    messages=messages,
                    output=ModelOutput.from_content(model=model, content=reply),
                    scores=scores,
                    metadata={
                        "family": fam,
                        "scored": bool(scores),
                        **({"notScored": not_scored} if not_scored else {}),
                        "wsbReadout": {
                            "family": fam,
                            "regex": fam in REGEX,
                            **({"options": options} if options else {}),
                            **({"gold": gold} if gold else {}),
                            **({"aliases": aliases} if aliases else {}),
                            **({"units": fact["units"]} if fact.get("units") else {}),
                            "lenses": lenses,
                        },
                    },
                )
            )
    for fam, key, n, mean, want in checks:
        print(f"{fam:36} {key:14} n={n:3} score={mean:.3f} (harness {want:.3f})")
    when = datetime.now(UTC).isoformat()
    log = EvalLog(
        status="success",
        eval=EvalSpec(
            created=when,
            task=TASK,
            task_args={"families": FAMILIES},
            dataset=EvalDataset(
                name=REPO,
                location=f"https://github.com/{REPO}/tree/{COMMIT}/evals",
                samples=len(samples),
                sample_ids=[s.id for s in samples],
                shuffled=False,
            ),
            model=model,
            config=EvalConfig(),
            packages={"inspect_ai": inspect_version},
            metadata={
                "source": f"https://github.com/{REPO}",
                "lenses": LENSES,
                "note": NOTE.format(commit=COMMIT[:7]),
            },
        ),
        stats=EvalStats(started_at=when, completed_at=when),
        samples=samples,
    )
    out = CACHE / "logs" / f"{SUBJECT.replace('/', '-')}.eval"
    out.parent.mkdir(parents=True, exist_ok=True)
    write_eval_log(log, str(out), format="eval")
    return out


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--cache",
        type=Path,
        default=CACHE,
        help="The run's files (default: %(default)s).",
    )
    CACHE = ap.parse_args().cache
    path = build()
    print(f"-> {path} ({path.stat().st_size >> 10} KB)")
