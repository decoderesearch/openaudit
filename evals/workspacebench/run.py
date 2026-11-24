"""Run WorkspaceBench on your workspace lens. Start it with ./run.sh (see README.md).

It runs the workspace-bench commit of the version with OpenAudit's patch (patches/): your lens
makes the readouts of each family (`wsbench produce`), then the judge of each family scores them
with an OpenAudit instrument (instruments/<version>.json). It writes the readouts, the judge files
and results.json to --out.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import logging
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
RESULTS_SCHEMA = "openaudit.workspacebench.results/1"
EVAL = "workspacebench"
INSTRUMENTS = {
    d["version"]: d
    for d in (json.loads(p.read_text()) for p in sorted((HERE / "instruments").glob("*.json")))
}
DEFAULT_VERSION = next(v for v, d in INSTRUMENTS.items() if d.get("default"))
WSB_ROOT = Path(os.environ.get("WSB_ROOT") or HERE / ".workspace-bench")
FULL_MODEL = "Qwen/Qwen3.6-27B"
FULL_MODEL_LAYERS = 64  # the read layers of the plan are layers of Qwen3.6-27B
TOP_K = 10

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("workspacebench")
logging.getLogger("httpx").setLevel(logging.WARNING)


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def pin(inst: dict) -> tuple[str, Path, Path]:
    """The workspace-bench commit of a version, its patch, and its checkout (one per commit)."""
    wb = inst["workspaceBench"]
    return wb["commit"], HERE / wb["patch"], WSB_ROOT / wb["commit"][:7]


def check_version_stamp(out: Path, version: str) -> None:
    """One --out folder holds one version: the read plans of two versions are not the same, and
    the readouts resume. A folder with no stamp takes the version of its results.json."""
    stamp = out / "version.txt"
    have = stamp.read_text().strip() if stamp.exists() else None
    if have is None and (out / "results.json").exists():
        runs = json.loads((out / "results.json").read_text()).get("runs", {})
        have = next((r["instrument"]["version"] for r in runs.values()), None)
    if have is not None and have != version:
        raise SystemExit(f"{out} has a run of version {have}: use another --out for {version}")
    stamp.write_text(version + "\n")


def git(*args: str, cwd: Path) -> str:
    return subprocess.run(
        ["git", *args], cwd=cwd, capture_output=True, text=True, check=False
    ).stdout.strip()


READOUTS = {
    "norm": "W_U · norm(J·h), with the model's final norm (the J++ Lens)",
    "cosine": "(W_U·J·h) / ‖Jᵀ W_U[t]‖, with no norm (the J-Lens)",
}


class LinearLens:
    """A `.pt` lens in the J format: the top 10 tokens of a readout of J[layer] · h (READOUTS),
    with the model's own unembedding."""

    name = "submission"

    def __init__(self, path: Path, readout: str = "norm") -> None:
        import torch

        # A submitted file: weights_only=True does not run pickled code.
        obj = torch.load(path, map_location="cpu", weights_only=True)
        if "J" not in obj:
            raise SystemExit(f"{path.name}: no J. See the J format in README.md.")
        self.J = {int(k): v.float() for k, v in obj["J"].items()}
        self.readout = readout
        self.layers = None  # the plan's layers; check_layers fails on a missing one
        self._dev: dict[int, object] = {}
        self._denom: dict[int, object] = {}

    def bind(self, backend) -> None:
        self._b = backend
        self._w_u = backend.unembed.detach().float()

    def _j(self, layer: int):
        if layer not in self.J:
            raise SystemExit(f"the lens has no J for layer {layer}")
        if layer not in self._dev:
            self._dev[layer] = self.J[layer].to(self._b.device)
        return self._dev[layer]

    def _cosine_denom(self, layer: int):
        """‖Jᵀ W_U[t]‖ for each token t, in vocab chunks: one (vocab, d) product can fill a GPU."""
        import torch

        if layer not in self._denom:
            j, w_u = self._j(layer), self._w_u
            self._denom[layer] = torch.cat(
                [(w_u[i : i + 32768] @ j).norm(dim=1) for i in range(0, w_u.shape[0], 32768)]
            ).clamp_min(1e-9)
        return self._denom[layer]

    def read_batch(self, hs, layer: int) -> list:
        import torch
        from wsbench.produce.methods import Readout
        from wsbench.produce.render import display_tokens

        b = self._b
        with torch.no_grad():
            x = hs.to(b.device).float() @ self._j(layer).T
            if self.readout == "cosine":
                scores = (x @ self._w_u.T) / self._cosine_denom(layer)
            else:
                scores = b.final_norm(x) @ self._w_u.T
            vals, ids = torch.topk(scores, TOP_K, dim=-1)
        return [
            Readout(
                tokens=display_tokens(b.tokenizer, i.tolist()),
                scores=[round(v, 4) for v in s.tolist()],
            )
            for i, s in zip(ids, vals, strict=True)
        ]

    def read(self, h, layer: int):
        return self.read_batch(h[None], layer)[0]


def load_lens(path: Path, model_name: str, readout: str):
    """Your lens: a `.pt` file in the J format, or a `.py` file with `load_reader`."""
    if path.suffix == ".py":
        spec = importlib.util.spec_from_file_location("submission_reader", path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if not hasattr(module, "load_reader"):
            raise SystemExit(f"{path} has no load_reader(model_name) function")
        reader = module.load_reader(model_name)
        for attr in ("bind", "read"):
            if not hasattr(reader, attr):
                raise SystemExit(f"the reader of {path.name} has no {attr}()")
        reader.name = getattr(reader, "name", "submission")
        reader.layers = getattr(reader, "layers", None)
        return reader
    return LinearLens(path, readout)


def read_layers(model, n_layers: int) -> list[int] | None:
    """None (the plan's layers) on Qwen3.6-27B; else the plan's layers scaled to the model."""
    from wsbench.readplan import GRID

    if model == FULL_MODEL:
        return None
    return sorted({max(1, round(n_layers * g / FULL_MODEL_LAYERS)) for g in GRID})


def lens_layers(lens, specs) -> list[int] | None:
    """The plan's layers that a J file has (it can stop before the last layer); None for a
    reader, which reads the plan's layers."""
    if not isinstance(lens, LinearLens):
        return None
    return sorted({x for s in specs for x in s.layers} & set(lens.J))


def parse_shard(s: str | None) -> tuple[int, int] | None:
    """`i/n` (0 <= i < n): this run reads every n-th item of each family, from item i."""
    if not s:
        return None
    i, _, n = s.partition("/")
    if not (i.isdigit() and n.isdigit() and 0 <= int(i) < int(n)):
        raise SystemExit(f"--shard needs i/n with 0 <= i < n, got {s!r}")
    return int(i), int(n)


def produce(
    args, lens, families: list[str], items: int, out: Path, fast: bool
) -> list[int] | None:
    """The readouts of each family with your lens, into out/readouts (resumable). `fast`: only
    the items and sites of the active fast subset. `args.shard`: only this shard's items."""
    from wsbench import readplan
    from wsbench.produce import Producer

    p = Producer.load(args.model, lens)
    layers = read_layers(args.model, p.backend.n_layers)
    if layers is not None:
        logger.info("%s: read layers %s (scaled from the plan)", args.model, layers)
    for fam in families:
        t0 = time.time()
        kw: dict = {"fast": True} if fast else {}  # an older commit has no fast subset
        fam_layers = layers if layers is not None else lens_layers(lens, readplan.plan(fam, **kw))
        if args.shard:
            i, n = args.shard
            plan = readplan.plan(fam, **kw)
            kw["items"] = [s.id for s in plan[: items or None]][i::n]
        p.run_family(
            fam, out / f"{fam}.jsonl", limit=0 if args.shard else items, layers=fam_layers, **kw
        )
        logger.info("produce %s: %.0f s", fam, time.time() - t0)
    return layers


def prompt_tokens(inst: dict, family: str, path: Path) -> dict[str, int]:
    """The estimated judge prompt of the largest question, under full and lite reads."""
    from wsbench import reads
    from wsbench.readouts import load_readouts

    est = inst["promptTokens"]
    cells, _ = load_readouts(path)

    def largest(cs) -> int:
        by_item: dict[str, float] = {}
        for c in cs:
            parts = list(c.samples) if c.samples is not None else [", ".join(c.tokens or ())]
            n = sum(len(t) / est["charsPerToken"] + est["perLine"] for t in parts)
            by_item[c.id] = by_item.get(c.id, est["fixed"]) + n
        return int(max(by_item.values(), default=0))

    lite = reads.select(cells, reads.specs(family), "lite")
    return {"full": largest(cells), "lite": largest(lite)}


def instrument_for(inst: dict, family: str, sizes: dict[str, int]) -> dict:
    """The reads and opts of a family: direct at full reads if the largest question fits, else
    direct at the lite site, else WorkspaceBench's digest at the lite site."""
    cap = inst["maxPromptTokens"]
    if sizes["full"] <= cap:
        return {"reads": "full", "opts": inst["opts"]}
    if sizes["lite"] <= cap:
        return {"reads": "lite", "opts": inst["opts"]}
    return {"reads": "lite", "opts": inst["fallbackOpts"]}


def family_opts(inst: dict, family: str) -> str:
    return inst.get("familyOpts", {}).get(family, inst["opts"])


DIGEST_ENV = "WSB_DIGEST_OF_RECORD"  # the patch: these summarizers count as of record


def summarizer_models(inst: dict) -> set[str]:
    """The summarizer models that the instrument names (`summ_model=`)."""
    opts = [inst["opts"], *inst.get("familyOpts", {}).values()]
    return {kv.split("=", 1)[1] for o in opts for kv in o.split(",") if kv.startswith("summ_model=")}


def openrouter_models(inst: dict) -> set[str]:
    """The summarizer models of the instrument that go through OpenRouter (an `org/model` name)."""
    return {m for m in summarizer_models(inst) if "/" in m}


def judge_env(inst: dict, effort: str | None, batch: bool) -> dict[str, str]:
    env = dict(os.environ)
    for name in ("WSB_JUDGE_EFFORT", "WSB_BATCH", "WSB_CLAUDE_VIA_OPENROUTER", DIGEST_ENV):
        env.pop(name, None)
    if summarizer_models(inst):  # else upstream marks each family not pinned, so not complete
        env[DIGEST_ENV] = ",".join(sorted(summarizer_models(inst)))
    if inst.get("cacheRepeatedPrompts"):
        env["WSB_CACHE_USER"] = "1"
    if effort:
        env["WSB_JUDGE_EFFORT"] = effort  # a family's own effort setting still wins
    if env.get("ANTHROPIC_API_KEY"):
        if batch:
            env["WSB_BATCH"] = "1"
    elif batch:
        raise SystemExit("--batch needs ANTHROPIC_API_KEY")
    elif env.get("OPENROUTER_API_KEY"):
        env["WSB_CLAUDE_VIA_OPENROUTER"] = "1"
    else:
        raise SystemExit("set ANTHROPIC_API_KEY or OPENROUTER_API_KEY for the judges")
    if openrouter_models(inst) and not env.get("OPENROUTER_API_KEY"):
        models = ", ".join(sorted(openrouter_models(inst)))
        raise SystemExit(f"version {inst['version']} needs OPENROUTER_API_KEY for {models}")
    return env


def judge_route(env: dict[str, str]) -> str:
    """How the Claude judges were called. Other judge models go through OpenRouter."""
    if env.get("WSB_BATCH") == "1":
        return "anthropic-batch"
    return "openrouter" if env.get("WSB_CLAUDE_VIA_OPENROUTER") == "1" else "anthropic"


def judge(
    inst: dict, fam: str, readouts: Path, out: Path, how: dict, args, ids: list[str] | None
) -> dict:
    """One family's `wsbench judge`. Its output goes to out/judge/<family>/run.log."""
    fdir = out / "judge" / fam
    fdir.mkdir(parents=True, exist_ok=True)
    env = judge_env(inst, args.judge_effort, args.batch)
    env["WSB_TOKEN_LEDGER"] = str(fdir / "ledger.jsonl")
    cmd = [
        str(Path(sys.executable).parent / "wsbench"),
        "judge",
        f"family={fam}",
        f"readouts={readouts}",
        f"out={fdir}",
        f"concurrency={args.concurrency}",
        f"reads={how['reads']}",
    ]
    if how["opts"]:
        cmd.append(f"opts={how['opts']}")
    if inst.get("fast"):
        cmd.append(f"fast={inst['fast']}")
    if args.judge_model:
        cmd.append(f"judge_model={args.judge_model}")
    if ids is not None:
        cmd.append(f"items={','.join(ids)}")
    if args.layers is not None:
        cmd.append(f"layers={','.join(map(str, args.layers))}")
    t0 = time.time()
    with open(fdir / "run.log", "w") as log:
        rc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, env=env, check=False)
    secs = round(time.time() - t0)
    tail = (fdir / "run.log").read_text(errors="replace").strip().splitlines()[-1:]
    logger.info("judge %s: exit %d, %d s. %s", fam, rc.returncode, secs, tail[0] if tail else "")
    return {"returncode": rc.returncode, "seconds": secs, "dir": fdir}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lens", required=True, help="a .pt file (J format) or a .py file")
    parser.add_argument(
        "--readout",
        default="norm",
        choices=sorted(READOUTS),
        help=f"the readout of a .pt lens. norm: {READOUTS['norm']}. cosine: {READOUTS['cosine']}",
    )
    parser.add_argument(
        "--version",
        default=DEFAULT_VERSION,
        choices=sorted(INSTRUMENTS),
        help="the instrument version (default %(default)s; a draft is not on the site yet)",
    )
    parser.add_argument("--model", default=None, help="default: the smoke model, Qwen3.5-0.8B")
    parser.add_argument("--out", required=True, help="output folder")
    parser.add_argument(
        "--families", default=None, help="comma list (default: the version's; smoke: 3)"
    )
    parser.add_argument("--limit", type=int, default=None, help="only the first N items of a family")
    parser.add_argument("--judge-only", action="store_true", help="judge the readouts in --out")
    parser.add_argument(
        "--produce-only", action="store_true", help="only the readouts: no judge, no API key"
    )
    parser.add_argument(
        "--shard", default=None, help="i/n with --produce-only: every n-th item, from item i"
    )
    parser.add_argument("--judge-model", default=None, help="one judge for all (a screen, not a score)")
    parser.add_argument(
        "--judge-effort",
        default=None,
        choices=["low", "medium", "high", "default"],
        help="Claude judge effort where a family sets none (default: the instrument's, low)",
    )
    parser.add_argument("--concurrency", type=int, default=16, help="judge calls at once, per family")
    parser.add_argument("--parallel", type=int, default=4, help="families judged at once")
    parser.add_argument(
        "--batch",
        action="store_true",
        help="Claude judges through the Anthropic Batch API: half the cost, can take hours",
    )
    args = parser.parse_args()

    inst = INSTRUMENTS[args.version]
    fast = inst.get("fast")
    smoke = inst["smoke"]
    args.model = args.model or smoke["model"]
    args.judge_effort = args.judge_effort or inst["judgeEffort"]
    tier = "full" if args.model == FULL_MODEL else "smoke"
    if tier == "smoke":
        args.limit = args.limit or smoke["items"]
        args.judge_model = args.judge_model or smoke["judgeModel"]
    families = (
        args.families.split(",")
        if args.families
        else (smoke["families"] if tier == "smoke" else inst["families"])
    )
    unknown = sorted(set(families) - set(inst["families"]) - set(inst.get("later", [])))
    if unknown:
        raise SystemExit(f"not families of version {inst['version']}: {', '.join(unknown)}")
    args.shard = parse_shard(args.shard)
    if args.shard and not args.produce_only:
        raise SystemExit("--shard needs --produce-only: merge the shards, then --judge-only")
    if args.produce_only and args.judge_only:
        raise SystemExit("--produce-only and --judge-only are opposites")
    if not args.produce_only:
        judge_env(inst, args.judge_effort, args.batch)  # fail on a missing key before GPU work
    lens_path = Path(args.lens).resolve()
    out = Path(args.out).resolve()
    readouts = out / "readouts"
    readouts.mkdir(parents=True, exist_ok=True)
    check_version_stamp(out, inst["version"])
    commit, patch, wsb_dir = pin(inst)
    if git("rev-parse", "HEAD", cwd=wsb_dir) != commit:
        raise SystemExit(f"{wsb_dir} is not at {commit}: run ./setup.sh --version {args.version}")
    os.chdir(wsb_dir)
    sys.path.insert(0, str(HERE))

    import scoring
    import torch as t
    from wsbench import registry

    registry.load_all()
    if fast:
        from wsbench import fast as wsb_fast

        wsb_fast.select(fast)
        if wsb_fast.VERSION != inst["fastSubset"] or set(wsb_fast.subset()) != set(inst["families"]):
            raise SystemExit(
                f"version {inst['version']} is for {inst['fastSubset']} and its families, "
                f"but this workspace-bench has {wsb_fast.VERSION}: run ./setup.sh again"
            )

    start = time.time()
    if args.judge_only:
        from transformers import AutoConfig

        cfg = AutoConfig.from_pretrained(args.model)
        cfg = getattr(cfg, "text_config", None) or cfg
        layers = read_layers(args.model, cfg.num_hidden_layers)
    else:
        lens = load_lens(lens_path, args.model, args.readout)
        layers = produce(args, lens, families, args.limit or 0, readouts, fast=bool(fast))
    if layers is None and args.model == FULL_MODEL:
        from wsbench.readplan import GRID

        args.layers = list(GRID)  # imported readouts can hold more layers than the plan
    else:
        args.layers = layers
    if args.produce_only:
        print(f"\nwrote the readouts to {readouts}. Judge them with --judge-only.")
        return

    plan: dict[str, dict] = {}
    for fam in families:
        if fast:  # a fast subset is defined on full reads, and the digest takes any size
            plan[fam] = {"reads": "full", "opts": family_opts(inst, fam)}
        else:
            sizes = prompt_tokens(inst, fam, readouts / f"{fam}.jsonl")
            plan[fam] = instrument_for(inst, fam, sizes) | {"largestPromptTokens": sizes}
        logger.info("%s: %s", fam, plan[fam])

    def ids_of(fam: str) -> list[str] | None:
        if not args.limit:
            return None
        lines = (readouts / f"{fam}.jsonl").read_text().splitlines()
        return sorted({json.loads(x)["id"] for x in lines if x.strip()})

    with ThreadPoolExecutor(args.parallel) as pool:
        runs = dict(
            zip(
                families,
                pool.map(
                    lambda f: judge(
                        inst, f, readouts / f"{f}.jsonl", out, plan[f], args, ids_of(f)
                    ),
                    families,
                ),
                strict=True,
            )
        )

    rows, failed = [], []
    for fam in families:
        res = runs[fam]["dir"] / "results.json"
        if runs[fam]["returncode"] != 0 or not res.exists():
            failed.append(fam)
            continue
        rows.append(scoring.family_row(res) | {k: plan[fam][k] for k in ("reads", "opts")})
    excluded = None
    if fast:  # WorkspaceBench's own macro, with its rules for the fast subset
        from wsbench import results as wsb_results

        done = [runs[f]["dir"] for f in families if f not in failed]
        wm = wsb_results.macro([wsb_results.read_results(d) for d in done])
        metrics = scoring.macro_metrics(rows, wm)
        excluded = wm["excluded"]
    else:
        metrics = scoring.metrics(rows, set(families) - set(registry.not_in_macro()))
    partial = bool(args.limit or failed or set(families) != set(inst["families"]))
    sources = out / "readout_sources.json"  # written by import_readouts.py
    lens_facts = {"file": lens_path.name, "sha256": sha256_of(lens_path)}
    if lens_path.suffix == ".pt":
        lens_facts["readout"] = args.readout
    run = {
        "model": args.model,
        "tier": tier,
        "partial": partial,
        "lens": lens_facts,
        "harness": {
            "openaudit": git("rev-parse", "HEAD", cwd=REPO),
            "openauditDirty": bool(git("status", "--porcelain", "--", str(HERE), cwd=REPO)),
            "workspaceBench": git("rev-parse", "HEAD", cwd=wsb_dir),
            "patch": patch.name,
            "patchSha256": sha256_of(patch),
        },
        "instrument": {
            "version": inst["version"],
            "draft": bool(inst.get("draft")),
            "fastSubset": inst.get("fastSubset"),
            "judgeModel": args.judge_model or "the judge of each family",
            "judgeEffort": args.judge_effort or "the effort of each family",
            "judgeRoute": judge_route(judge_env(inst, args.judge_effort, args.batch)),
            "summarizersOfRecord": sorted(summarizer_models(inst)),
        },
        "layers": layers,
        **({"readoutSources": json.loads(sources.read_text())} if sources.exists() else {}),
        "evals": {
            EVAL: {
                "version": inst["version"],
                "metrics": metrics,
                "families": {r["family"]: r for r in rows},
                "failed": failed,
                **({"macroExcluded": excluded} if excluded is not None else {}),
            }
        },
        "spendUsd": round(sum(r["spendUsd"] or 0 for r in rows), 2),
        "seconds": round(time.time() - start),
        "gpus": [t.cuda.get_device_name(i) for i in range(t.cuda.device_count())],
        "torch": t.__version__,
        "date": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    results_path = out / "results.json"
    results = json.loads(results_path.read_text()) if results_path.exists() else {}
    results["schema"] = RESULTS_SCHEMA
    results.setdefault("runs", {})[args.model] = run
    results_path.write_text(json.dumps(results, indent=2) + "\n")

    m = run["evals"][EVAL]["metrics"]
    print(f"\n{EVAL} {inst['version']} on {args.model}:")
    for r in rows:
        print(f"  {r['family']:36s} {r['value'] if r['value'] is not None else '-':>8}  ({r['reads']})")
    print(f"  macro_score {m.get('macro_score')} over {m.get('macro_families')} families")
    for x in excluded or []:
        print(f"  not in the macro: {x['family']} ({x['reason']})")
    print(f"  judge spend ${run['spendUsd']}")
    if failed:
        print(f"failed: {', '.join(failed)}. See {out}/judge/<family>/run.log.")
    print(f"\nwrote {results_path}")
    if tier == "smoke":
        print("smoke tier: this checks that the run works. Its scores are not results.")
    elif partial:
        print("a partial run (--limit, other --families or a failed family). Do not submit it.")
    if inst.get("draft"):
        print(f"version {inst['version']} is a draft: it is not on the site yet.")


if __name__ == "__main__":
    main()
