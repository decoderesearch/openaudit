"""Export a fast run for the site: one JSON line for each read item of each family, with its prompt,
its unit, and for each lens the cells that the judge read and the judge's verdict and notes.

Run it in the workspace-bench environment of the run's version:
  uv run --no-sync --project .workspace-bench/<commit> python export.py \
      --run out/ours-<version> [--lenses jlens,jpp,olens]
It reads <run>/<lens>/{version.txt,results.json,readouts/,judge/<family>/results.json} and writes
<run>/export/<family>.jsonl and <run>/export/run.json. data/scripts/workspacebench-fast-logs.py
makes the Inspect log from them.

A unit is one scored question (wsbench.fast.units). Most units are one item. A unit of two items
(a buggy file and its clean twin, a hinted prompt and its control, the two orders of a story, an
introspection trial and its control) puts its score on the first item; the other item has no score.

nocot-bench asks that its questions are not republished. So a knowledge_cutoff item from nocot keeps
only its id and the result of each lens: no prompt, readouts, options or judge text.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from wsbench import fast, nocot, readplan, reads, registry
from wsbench.readplan import GRID
from wsbench.registry import JudgeArgs
from wsbench.results import read_results

LENSES = {"jlens": "jacobian_lens", "jpp": "jpp_lens", "olens": "oracle_lens"}
MAX_TEXT = 600  # the start of each text sample that the view shows
MAX_STATEMENTS = 15
MAX_NOTE = 1200
REASONS = ("reason", "inferred", "rationale", "evidence")  # the judge's own words, by family


def clip(s: Any, n: int = MAX_NOTE) -> str | None:
    """The text cut to `n` characters; None for a redacted text (the harness's "[redacted: ...]")."""
    if s is None:
        return None
    s = s if isinstance(s, str) else json.dumps(s, ensure_ascii=False)
    s = s.strip()
    if s.startswith("[redacted:"):
        return None
    return s if len(s) <= n else s[: n - 1] + "…"


def as_obj(v: Any) -> Any:
    """A row field that the harness may write as a JSON string."""
    if isinstance(v, str) and v[:1] in "[{":
        try:
            return json.loads(v)
        except ValueError:
            return v
    return v


def option_at(options: list | None, i: Any, base: int) -> str | None:
    """The option at index `i` (`base` 0 or 1), or at a letter (A is the first)."""
    if not options or i is None or isinstance(i, bool):
        return None
    if isinstance(i, str):
        if len(i) == 1 and i.isalpha():
            i, base = ord(i.upper()) - ord("A"), 0
        elif i.isdigit():
            i = int(i)
        else:
            return None
    k = int(i) - base
    return str(options[k]) if 0 <= k < len(options) else None


def statements(r: dict, prefix: str = "") -> list[dict]:
    """The summarizer's notes: each statement, its support and its evidence line."""
    src = as_obj(r.get(f"{prefix}summary"))
    st = as_obj(src.get("summary_statements")) if prefix and isinstance(src, dict) else None
    st = st or as_obj(r.get(f"{prefix}summary_statements")) or []
    out = []
    for s in st[:MAX_STATEMENTS]:
        if isinstance(s, str):
            if (text := clip(s, 400)) is not None:
                out.append({"text": text})
        elif isinstance(s, dict) and clip(s.get("statement")):
            out.append(
                {
                    "text": clip(s["statement"], 400),
                    **({"support": s["support"]} if s.get("support") else {}),
                    **({"evidence": clip(s["evidence"], 300)} if s.get("evidence") else {}),
                }
            )
    return out


def roles(r: dict) -> tuple[dict[str, bool] | None, str | None]:
    """A multi-role family's hit on each role, and what the judge picked for each."""
    units = as_obj(r.get("unit_correct") or r.get("unit_hit"))
    units = {k: bool(v) for k, v in units.items()} if isinstance(units, dict) else None
    by_role = (
        (as_obj(r.get("layers")) or {}).get("-1")
        if isinstance(as_obj(r.get("layers")), dict)
        else None
    )
    if not isinstance(by_role, dict):
        mc = as_obj(r.get("mc"))
        by_role = (
            {m["role"]: m for m in mc.values() if isinstance(m, dict) and "role" in m}
            if isinstance(mc, dict)
            else None
        )
    if not by_role:
        return units, None
    parts = []
    for role, m in by_role.items():
        if not isinstance(m, dict):
            continue
        name = role.replace("_", " ")
        kind = m.get("kind")
        if kind in ("cannot", "cannot_tell"):
            parts.append(f"{name}: the judge said that the readout cannot tell.")
        elif m.get("correct"):
            q = f' (quote: "{clip(m["quote"], 120)}")' if m.get("quote") else ""
            parts.append(f"{name}: the judge picked {m.get('gold')}{q}.")
        elif kind == "correct":
            parts.append(
                f"{name}: the judge picked {m.get('gold')}, but its quote does not hold it."
            )
        else:
            parts.append(f"{name}: the judge picked another option, not {m.get('gold')}.")
    return units, " ".join(parts) or None


def num(x: Any) -> str:
    """A number as the site shows it: 16, not 16.0."""
    f = float(x)
    return str(int(f)) if f.is_integer() else f"{f:g}"


def nums(xs: list, n: int = 10) -> str:
    return ", ".join(num(x) for x in xs[:n]) + (f" and {len(xs) - n} more" if len(xs) > n else "")


def intermediate(r: dict) -> tuple[str, str | None, str]:
    """arithmetic_intermediates: the hidden step as the gold, the kept value that hits it (else the
    first kept value) as the pick, and the values that the judge named and the harness kept."""
    target = float(r["intermediate"])
    named, kept = r.get("values") or [], r.get("kept") or []
    near = min(kept, key=lambda v: abs(float(v) - target)) if kept else None
    pick = near if r.get("hit") else next(iter(kept), None)
    if not named:
        return num(target), None, "The judge named no number."
    dropped = [v for v in dict.fromkeys(named) if v not in kept]
    why = [f"The judge named {nums(named)}."]
    if kept:
        why.append(f"Kept: {nums(kept)}.")
    if dropped:
        flood = r.get("kind") == "flood"
        cause = "only a list of many numbers names them" if flood else "not verified in the readout"
        why.append(f"Dropped ({cause}): {nums(dropped)}.")
    return num(target), None if pick is None else num(pick), " ".join(why)


def verdict(r: dict | None, prefix: str = "") -> dict:
    """The judge's pick, quote, reasoning and the summarizer's notes for one item's row."""
    if not r:
        return {}
    options = as_obj(r.get("options"))
    options = options if isinstance(options, list) else None
    gold = r.get("gold")
    if gold is None:
        for key, base in (("gold_idx", 0), ("gold_position", 1), ("gold_pos", 1)):
            if r.get(key) is not None:
                gold = option_at(options, r[key], base)
                break
    pick = (
        option_at(options, r.get("choice"), 1) or r.get("word") or r.get("pick") or r.get("claim")
    )
    pick = pick or r.get("choice_kind") or r.get("pick_class")
    if prefix and r.get(f"{prefix}flagged") is not None:
        pick = "flagged" if r[f"{prefix}flagged"] else "not flagged"
        gold = "flagged" if prefix == "I_" else "not flagged"
    if pick == "gold":
        pick = gold
    units, why = roles(r)
    quote = r.get(f"{prefix}quote") or r.get("quote")
    quotes = as_obj(r.get(f"{prefix}quotes"))
    if quote is None and isinstance(quotes, (list, dict)):
        quote = next(iter(quotes.values() if isinstance(quotes, dict) else quotes), None)
    if r.get("intermediate") is not None:
        gold, pick, why = intermediate(r)
    if not why:
        why = next((r[k] for k in REASONS if isinstance(r.get(k), str) and r[k].strip()), None)
    out = {
        "gold": None if gold is None else str(gold),
        "options": [str(o) for o in options] if options else None,
        "pick": None if pick in (None, "") else str(pick).replace("_", " "),
        "quote": clip(quote, 300),
        "units": units,
        "why": clip(as_obj(why)),
        "statements": statements(r, prefix) or None,
        "redacted": r.get("redacted"),
    }
    return {k: v for k, v in out.items() if v is not None}


def item_units(
    fam: str, read_ids: list[str], unit_ids: set[str], rows: list[dict]
) -> dict[str, tuple[str, bool]]:
    """Item id -> (unit id, True when the item carries the unit's score)."""
    out: dict[str, tuple[str, bool]] = {}
    if fam == "buggy_code":  # a unit is named after the clean twin of its buggy file
        for r in rows:
            if (r.get("src") or r.get("arm")) == "buggy" and r.get("pair"):
                out[str(r["id"])] = (str(r["pair"]), True)
                out[str(r["pair"])] = (str(r["pair"]), False)
    elif fam == "agentic_misalignment":  # a unit is named after the twin of its misaligned prompt
        for u in unit_ids:
            out[u] = (u, False)
            out[u.removesuffix("~twin")] = (u, True)
    elif fam == "hinted_cutoff":  # unit "<I>~<N>"; the item ids are cue__<x with | as __>
        for u in unit_ids:
            i, n = (f"cue__{x.replace('|', '__')}" for x in u.split("~"))
            out[i], out[n] = (u, True), (u, False)
    elif fam == "role_bound_association":  # a unit folds the two orders, -ab and -ba
        for i in read_ids:
            u = i.rsplit("-", 1)[0]
            if u in unit_ids:
                out[i] = (u, i.endswith("-ab"))
    elif fam == "nyt_connections":  # a unit is one stable slot of a puzzle, "<puzzle>|s<k>"
        by_puzzle = defaultdict(list)
        for u in unit_ids:
            by_puzzle[u.split("|")[0]].append(u)
        for p, us in by_puzzle.items():
            if len(us) > 1:
                raise SystemExit(
                    f"{fam}: puzzle {p} has {len(us)} units; one sample cannot hold them"
                )
            out[p] = (us[0], True)
    elif fam == "introspection":  # a control shares the trial's id after its kind
        by_tail = {u.split("|", 1)[1]: u for u in unit_ids}
        for i in read_ids:
            if i in unit_ids:
                out[i] = (i, True)
            elif (u := by_tail.get(i.split("|", 1)[1])) is not None:
                out[i] = (u, False)
    else:
        for i in read_ids:
            if i in unit_ids:
                out[i] = (i, True)
    return out


def rows_of(fam: str, res) -> dict[str, list[dict]]:
    """Item id -> its rows. hinted_cutoff has one row for the pair: both items get it."""
    out: dict[str, list[dict]] = defaultdict(list)
    for r in res.rows:
        if fam == "hinted_cutoff":
            for side in ("I", "N"):
                if r.get(side):
                    out[str(r[side])].append(r)
        elif fam == "nyt_connections":
            out[str(r.get("puzzle") or str(r.get("id")).split("|")[0])].append(r)
        else:
            rid = r.get("item") if fam == "directed_modulation" else r.get("id")
            if rid is not None:
                out[str(rid)].append(r)
    return out


def pick_row(fam: str, rows: list[dict], unit: str) -> dict | None:
    """The row that holds the item's verdict."""
    if not rows:
        return None
    if fam == "introspection":
        return next((r for r in rows if r.get("role") == "headline"), None) or next(
            (r for r in rows if r.get("id") == r.get("item")), rows[0]
        )
    if fam == "nyt_connections":
        return next((r for r in rows if r.get("id") == unit), None)
    if fam == "jailbreak_recognition":
        return max(rows, key=lambda r: len(as_obj(r.get("summary_statements")) or []))
    return rows[-1]


def grid(cells: list) -> dict:
    """`cells[layer][position]`: the top tokens or the text samples that the judge read."""
    layers = sorted({c.layer for c in cells})
    positions = sorted({c.pos for c in cells})
    token = {c.pos: c.token or "" for c in cells}
    li = {x: i for i, x in enumerate(layers)}
    pi = {x: i for i, x in enumerate(positions)}
    out: list[list[list[str] | None]] = [[None] * len(positions) for _ in layers]
    text = any(c.samples is not None for c in cells)
    for c in cells:
        v = [s[:MAX_TEXT] for s in c.samples] if c.samples is not None else list(c.tokens or [])
        out[li[c.layer]][pi[c.pos]] = v
    return {
        "kind": "text" if text else "tokens",
        "layers": layers,
        "positions": [{"pos": p, "token": token[p]} for p in positions],
        "cells": out,
    }


def prompt(spec, tok) -> dict:
    """What the model read: the chat turns and the plain text of a read item."""
    d = spec.row()
    text = d.get("text")
    if text is None and d.get("extra", {}).get("input_ids") and tok is not None:
        text = tok.decode(d["extra"]["input_ids"])
    if text is not None and d.get("suffix"):
        text += d["suffix"]
    keep = ("render", "system", "messages", "prefill", "assistant")
    return {"text": text, **{k: d[k] for k in keep if d.get(k)}}


def private_ids(fam: str) -> set[str]:
    """The family's items that the export must not show: knowledge_cutoff's nocot items."""
    return {it["id"] for it in nocot.load_obscure()[1]} if fam == "knowledge_cutoff" else set()


def redact(lens: dict) -> dict:
    """A lens's readout of a private item: no cells, and only the result of its verdict."""
    v = {k: lens["verdict"][k] for k in ("pass", "value") if k in lens["verdict"]}
    return {
        "kind": lens["kind"],
        "layers": [],
        "positions": [],
        "cells": [],
        "verdict": {**v, "redacted": "nocot"},
    }


def unit_pass(fam: str, group: str, v: float) -> bool:
    """Whether a unit's outcome is the good one. jailbreak_recognition: a control passes when it
    is not flagged. hinted_cutoff: +1 (the hint is flagged only in the hinted prompt)."""
    if fam == "jailbreak_recognition" and group == "control":
        return v == 0.0
    return v == 1.0


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", type=Path, required=True)
    ap.add_argument("--lenses", default=",".join(LENSES))
    ap.add_argument("--families", default="")
    ap.add_argument("--tokenizer", default="Qwen/Qwen3.6-27B")
    args = ap.parse_args()
    lenses = [x for x in args.lenses.split(",") if x]
    versions = {(args.run / x / "version.txt").read_text().strip() for x in lenses}
    if len(versions) != 1:
        raise SystemExit(f"the lenses have more than one version: {versions}")
    version = versions.pop()
    results = {x: json.loads((args.run / x / "results.json").read_text()) for x in lenses}
    run0 = next(iter(results[lenses[0]]["runs"].values()))
    fast.select("safety" if run0["instrument"]["fastSubset"] == fast.VARIANTS["safety"] else "")
    families = [f for f in args.families.split(",") if f] or sorted(fast.subset())
    try:
        from transformers import AutoTokenizer

        tok = AutoTokenizer.from_pretrained(args.tokenizer)
    except Exception as e:  # noqa: BLE001
        print(f"no tokenizer ({e}); captured prompts keep no text", file=sys.stderr)
        tok = None
    out_dir = args.run / "export"
    out_dir.mkdir(exist_ok=True)
    summary: dict[str, Any] = {"version": version, "families": {}}
    for fam in families:
        e = fast.subset()[fam]
        read_ids = list(e["read_ids"])
        unit_ids = {u for g in e["units"] for u in e["units"][g]}
        group_of = {u: g for g in e["units"] for u in e["units"][g]}
        plan = {s.id: s for s in readplan.plan(fam, fast=True)}
        per_lens: dict[str, dict] = {}
        all_rows: list[dict] = []
        for x in lenses:
            jdir = args.run / x / "judge" / fam
            if not (jdir / "results.json").exists():
                print(f"{fam} {x}: no results", file=sys.stderr)
                continue
            res = read_results(jdir)
            groups, sign = fast.units(fam, res)
            kept = {
                g: {u: v for u, v in groups.get(g, {}).items() if u in e["units"][g]} for g in sign
            }
            value = fast.value_of(kept, sign)
            if res.value is not None and (value is None or abs(value - res.value) > 1e-9):
                raise SystemExit(f"{fam} {x}: units give {value}, results.json has {res.value}")
            jargs = JudgeArgs(
                readouts=args.run / x / "readouts" / f"{fam}.jsonl",
                out=jdir,
                judge=None,  # type: ignore[arg-type]
                layers=list(GRID),
                items=None,
                limit=0,
                allow_missing=True,
                concurrency=1,
                rpm=0,
                dry_run=True,
                extra={"aggregate": "summary"},
                scope=fast.SCOPE,
            )
            cells, _ = reads.load(jargs, fam, jargs.readouts)
            by_item: dict[str, list] = defaultdict(list)
            for c in cells:
                by_item[c.id].append(c)
            outcome = {u: v for g in kept for u, v in kept[g].items()}
            per_lens[x] = {"rows": rows_of(fam, res), "cells": by_item, "outcome": outcome}
            all_rows += res.rows
            summary["families"].setdefault(fam, {})[LENSES[x]] = {
                "value": res.value,
                "nUnits": len(unit_ids),
                "nScored": len(outcome),
            }
        units = item_units(fam, read_ids, unit_ids, all_rows)
        missing = sorted(unit_ids - {u for u, first in units.values() if first})
        if missing:
            raise SystemExit(f"{fam}: {len(missing)} units have no scored item, e.g. {missing[0]}")
        private = private_ids(fam)
        n = 0
        with (out_dir / f"{fam}.jsonl").open("w") as f:
            for iid in read_ids:
                unit, first = units.get(iid, (None, False))
                item: dict[str, Any] = {
                    "family": fam,
                    "regex": registry.get(fam).scorer == "regex",
                    "id": iid,
                    "unit": unit,
                    "scored": bool(unit and first),
                    "group": group_of.get(unit) if unit else None,
                    "prompt": {"redacted": "nocot"} if iid in private else prompt(plan[iid], tok),
                    "lenses": {},
                }
                if unit and not first:
                    item["scoredWith"] = next(
                        (i for i, (u, s) in units.items() if u == unit and s), None
                    )
                for x, d in per_lens.items():
                    cs = d["cells"].get(iid)
                    if not cs:
                        continue
                    prefix = ""
                    if fam == "hinted_cutoff":
                        prefix = "I_" if first else "N_"
                    v = verdict(pick_row(fam, d["rows"].get(iid, []), unit or ""), prefix)
                    if item["scored"]:
                        o = d["outcome"].get(unit)
                        v["pass"] = None if o is None else unit_pass(fam, item["group"], o)
                        if o is not None:
                            v["value"] = o
                        if fam == "jailbreak_recognition":
                            v["gold"] = (
                                "recognized" if item["group"] == "jailbreak" else "not recognized"
                            )
                            if o is not None:
                                v["pick"] = "recognized" if o == 1.0 else "not recognized"
                    lens = {**grid(cs), "verdict": v}
                    item["lenses"][LENSES[x]] = redact(lens) if iid in private else lens
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
                n += 1
        print(f"{fam:36} items={n:4} units={len(unit_ids):4}")
    summary["results"] = {LENSES[x]: results[x] for x in lenses}
    (out_dir / "run.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {out_dir}")


if __name__ == "__main__":
    main()
