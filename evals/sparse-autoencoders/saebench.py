"""Run the OpenAudit SAEBench evals on your SAE. Start it with ./run.sh saebench (see README.md).

It runs SAEBench at the pinned commit (setup.sh) with the settings of the published SAEBench
results (saebench_configs.json), on one subject model. Writes results.json and the SAEBench result
files to --out.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import common

# Hub name: the SAEBench model name and the layer of the published SAEs (resid_post).
SUBJECTS = {
    "google/gemma-2-2b": {"name": "gemma-2-2b", "layer": 12},
    "EleutherAI/pythia-160m-deduped": {"name": "pythia-160m-deduped", "layer": 8},
}
# SAEBench eval: the OpenAudit eval, its version, the headline metric (and if lower is better), and
# the metrics (key: path in eval_result_metrics).
EVALS = {
    "core": (
        "sae-bench-core",
        "2025-01",
        ("ce_loss_score", False),
        {
            "ce_loss_score": "model_performance_preservation.ce_loss_score",
            "l0": "sparsity.l0",
            "kl_div_score": "model_behavior_preservation.kl_div_score",
            "explained_variance": "reconstruction_quality.explained_variance",
            "frac_alive": "misc_metrics.frac_alive",
        },
    ),
    "sparse_probing": (
        "sae-bench-sparse-probing",
        "2025-01",
        ("sae_top_1_test_accuracy", False),
        {
            "sae_top_1_test_accuracy": "sae.sae_top_1_test_accuracy",
            "sae_top_5_test_accuracy": "sae.sae_top_5_test_accuracy",
            "sae_test_accuracy": "sae.sae_test_accuracy",
            "llm_top_1_test_accuracy": "llm.llm_top_1_test_accuracy",
            "llm_test_accuracy": "llm.llm_test_accuracy",
        },
    ),
    "absorption": (
        "sae-bench-absorption",
        "2025-01",
        ("mean_absorption_fraction_score", True),
        {
            "mean_absorption_fraction_score": "mean.mean_absorption_fraction_score",
            "mean_full_absorption_score": "mean.mean_full_absorption_score",
            "mean_num_split_features": "mean.mean_num_split_features",
        },
    ),
    "scr": (
        "sae-bench-scr",
        "2025-01",
        ("scr_k20", False),
        {
            "scr_k20": "scr_metrics.scr_metric_threshold_20",
            "scr_k5": "scr_metrics.scr_metric_threshold_5",
            "scr_k50": "scr_metrics.scr_metric_threshold_50",
        },
    ),
    "tpp": (
        "sae-bench-tpp",
        "2025-01",
        ("tpp_k20", False),
        {
            "tpp_k20": "tpp_metrics.tpp_threshold_20_total_metric",
            "tpp_k5": "tpp_metrics.tpp_threshold_5_total_metric",
            "tpp_k50": "tpp_metrics.tpp_threshold_50_total_metric",
        },
    ),
    "ravel": (
        "sae-bench-ravel",
        "2025-03",
        ("disentanglement_score", False),
        {
            "disentanglement_score": "ravel.disentanglement_score",
            "cause_score": "ravel.cause_score",
            "isolation_score": "ravel.isolation_score",
        },
    ),
    "unlearning": (
        "sae-bench-unlearning",
        "2025-01",
        ("unlearning_score", False),
        {"unlearning_score": "unlearning.unlearning_score"},
    ),
    "autointerp": (
        "sae-bench-autointerp",
        "2025-01",
        ("autointerp_score", False),
        {"autointerp_score": "autointerp.autointerp_score"},
    ),
}
# The evals that need no gated data and no paid API.
DEFAULT_EVALS = ["core", "sparse_probing", "absorption", "scr", "tpp", "ravel"]
# Core streams OpenWebText with no revision. Its Parquet version (2025-12) gives other samples.
DATASET_REVISIONS = {
    "Skylion007/openwebtext": "f3808c30e817981b845ec549c43e82bb467d8144"
}
UNLEARNING_DATA = Path("sae_bench/evals/unlearning/data/bio-forget-corpus.jsonl")
SMOKE_CORE = {
    "n_eval_reconstruction_batches": 5,
    "n_eval_sparsity_variance_batches": 20,
}


def pick(metrics: dict, path: str):
    for k in path.split("."):
        metrics = metrics.get(k) if isinstance(metrics, dict) else None
    return metrics


def check_saebench_sae(sae, subject: dict, d_model: int, device) -> None:
    import torch

    common.check_sae(sae, d_model, device)
    cfg = getattr(sae, "cfg", None)
    hook = f"blocks.{subject['layer']}.hook_resid_post"
    if (
        cfg is None
        or cfg.model_name != subject["name"]
        or cfg.hook_name != hook
        or cfg.hook_layer != subject["layer"]
    ):
        raise SystemExit(
            f"sae.cfg must have model_name {subject['name']!r}, hook_name {hook!r} and hook_layer "
            f"{subject['layer']}: subclass sae_bench.custom_saes.base_sae.BaseSAE"
        )
    norms = sae.W_dec.detach().float().norm(dim=1)
    tol = 1e-2 if sae.W_dec.dtype in (torch.bfloat16, torch.float16) else 1e-5
    if not torch.allclose(norms, torch.ones_like(norms), atol=tol):
        raise SystemExit(
            f"SAEBench needs W_dec rows of norm 1 (max error {(norms - 1).abs().max():.2e}). "
            "Move the norms into W_enc and b_enc."
        )


def pin_datasets() -> None:
    """Makes SAELens's activation store load the datasets of DATASET_REVISIONS at their revision."""
    import sae_lens.training.activations_store as store

    load = store.load_dataset

    def pinned(path, *args, **kwargs):
        if isinstance(path, str) and path in DATASET_REVISIONS:
            kwargs |= {"revision": DATASET_REVISIONS[path], "trust_remote_code": True}
        return load(path, *args, **kwargs)

    store.load_dataset = pinned


def run_eval(name: str, cfg: dict, sae_name: str, sae, device: str, out: Path) -> dict:
    """Runs one SAEBench eval and returns its result file."""
    from sae_bench.evals.absorption import main as absorption
    from sae_bench.evals.autointerp import main as autointerp
    from sae_bench.evals.core import main as core
    from sae_bench.evals.ravel import main as ravel
    from sae_bench.evals.scr_and_tpp import main as scr_and_tpp
    from sae_bench.evals.sparse_probing import main as sparse_probing
    from sae_bench.evals.unlearning import main as unlearning

    selected = [(sae_name, sae)]
    folder = out / name
    folder.mkdir(parents=True, exist_ok=True)
    if name == "core":
        core.multiple_evals(
            selected_saes=selected,
            n_eval_reconstruction_batches=cfg["n_eval_reconstruction_batches"],
            n_eval_sparsity_variance_batches=cfg["n_eval_sparsity_variance_batches"],
            eval_batch_size_prompts=cfg["batch_size_prompts"],
            compute_featurewise_density_statistics=cfg[
                "compute_featurewise_density_statistics"
            ],
            compute_featurewise_weight_based_metrics=cfg[
                "compute_featurewise_weight_based_metrics"
            ],
            exclude_special_tokens_from_reconstruction=cfg[
                "exclude_special_tokens_from_reconstruction"
            ],
            dataset=cfg["dataset"],
            context_size=cfg["context_size"],
            output_folder=str(folder),
            dtype=cfg["llm_dtype"],
            device=device,
            force_rerun=True,
        )
    elif name in ("scr", "tpp"):
        config = scr_and_tpp.ScrAndTppEvalConfig(**cfg)
        scr_and_tpp.run_eval(
            config,
            selected,
            device,
            str(out),
            force_rerun=True,
            clean_up_activations=True,
            save_activations=False,
        )
    elif name == "sparse_probing":
        config = sparse_probing.SparseProbingEvalConfig(**cfg)
        sparse_probing.run_eval(
            config,
            selected,
            device,
            str(folder),
            force_rerun=True,
            clean_up_activations=True,
            save_activations=False,
        )
    elif name == "absorption":
        absorption.run_eval(
            absorption.AbsorptionEvalConfig(**cfg),
            selected,
            device,
            str(folder),
            force_rerun=True,
        )
    elif name == "ravel":
        ravel.run_eval(
            ravel.RAVELEvalConfig(**cfg),
            selected,
            device,
            str(folder),
            force_rerun=True,
        )
    elif name == "unlearning":
        config = unlearning.UnlearningEvalConfig(**cfg)
        unlearning.run_eval(
            config,
            selected,
            device,
            str(folder),
            force_rerun=True,
            clean_up_artifacts=True,
        )
    elif name == "autointerp":
        key = os.environ["OPENAI_API_KEY"]
        autointerp.run_eval(
            autointerp.AutoInterpEvalConfig(**cfg),
            selected,
            device,
            key,
            str(folder),
            force_rerun=True,
        )
    files = sorted(folder.glob(f"{sae_name}*_eval_results.json"))
    if len(files) != 1:
        raise SystemExit(
            f"{name}: expected one result file in {folder}, found {len(files)}"
        )
    return json.loads(files[0].read_text())


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--sae",
        required=True,
        help="a .py file with load_sae(model, layer, device, dtype)",
    )
    parser.add_argument(
        "--model", required=True, choices=list(SUBJECTS), help="the subject model"
    )
    parser.add_argument("--out", required=True, help="output folder")
    parser.add_argument(
        "--evals",
        help=f"from: {', '.join(EVALS)}. Default: those of {', '.join(DEFAULT_EVALS)} with published results",
    )
    parser.add_argument(
        "--smoke", action="store_true", help="a short core run, to test the SAE file"
    )
    args = parser.parse_args()

    subject = SUBJECTS[args.model]
    configs = json.loads((HERE / "saebench_configs.json").read_text())[subject["name"]]
    if args.smoke:
        names = ["core"]
    elif args.evals:
        names = [e.strip() for e in args.evals.split(",") if e.strip()]
    else:
        names = [e for e in DEFAULT_EVALS if e in configs]
    for name in names:
        if name not in EVALS:
            raise SystemExit(f"unknown eval {name}: use {', '.join(EVALS)}")
        if name not in configs:
            raise SystemExit(
                f"{name}: SAEBench has no published {subject['name']} results"
            )
    path = Path(args.sae).resolve()
    out = Path(args.out).resolve()
    saebench_dir = Path(os.environ["SAEBENCH_DIR"]).resolve()
    if "unlearning" in names and not (saebench_dir / UNLEARNING_DATA).exists():
        raise SystemExit(
            f"unlearning needs the WMDP bio forget corpus at {saebench_dir / UNLEARNING_DATA}"
        )
    if "autointerp" in names and not os.environ.get("OPENAI_API_KEY"):
        raise SystemExit(
            "autointerp needs OPENAI_API_KEY (it calls gpt-4o-mini, a paid API)"
        )

    import torch
    from sae_bench.sae_bench_utils.general_utils import str_to_dtype

    # SAEBench reads and writes some files relative to its own folder.
    os.chdir(saebench_dir)
    pin_datasets()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = str_to_dtype(configs["core"]["llm_dtype"])
    sha = common.sha256_of(path)
    sae = common.load_module(path, "submission_sae").load_sae(
        args.model, subject["layer"], device, dtype
    )
    sae = sae.to(dtype=dtype, device=device)
    check_saebench_sae(sae, subject, sae.W_dec.shape[1], device)
    sae_name = f"openaudit-{sha[:12]}"

    evals = {}
    raw = out / "saebench" / subject["name"]
    for name in names:
        slug, version, _, paths = EVALS[name]
        cfg = configs[name] | (SMOKE_CORE if args.smoke else {})
        print(f"\n=== {name} ({slug} {version})", flush=True)
        t = time.time()
        result = run_eval(name, cfg, sae_name, sae, device, raw)
        found = result["eval_result_metrics"]
        metrics = {k: pick(found, p) for k, p in paths.items()}
        # The files write -1 for KL when they do not compute it.
        if pick(found, "model_behavior_preservation.kl_div_with_sae") == -1:
            metrics.pop("kl_div_score", None)
        seconds = round(time.time() - t)
        evals[slug] = {
            "version": version,
            "metrics": {
                k: v for k, v in metrics.items() if isinstance(v, (int, float))
            },
            "seconds": seconds,
        }
        # One write for each eval: if a later eval fails, the run keeps this one.
        common.write_run(
            out,
            args.model,
            {
                "suite": "saebench",
                "tier": "smoke" if args.smoke else "full",
                "partial": args.smoke,
                "sae": {"file": path.name, "sha256": sha, "dSae": sae.W_dec.shape[0]},
                "sites": [
                    {
                        "address": f"resid_post.{subject['layer']}",
                        "role": "read",
                        "source": sae.cfg.hook_name,
                    }
                ],
                "harness": common.harness_info(HERE)
                | {"saebench": result.get("sae_bench_commit_hash")},
                "evals": {slug: evals[slug]},
                "seconds": seconds,
                "gpus": common.gpus(),
                "torch": torch.__version__,
            },
        )
        torch.cuda.empty_cache()

    for name in names:
        slug, version, (headline, lower), _ = EVALS[name]
        print(f"\n{slug} {version}:")
        for k, v in evals[slug]["metrics"].items():
            print(f"  {k}: {v:.4f}")
        if headline in evals[slug]["metrics"]:
            common.leaderboard(
                args.model,
                slug,
                headline,
                evals[slug]["metrics"][headline],
                lower=lower,
            )
    if args.smoke:
        print("--smoke: a short core run. Do not submit it.")


if __name__ == "__main__":
    main()
