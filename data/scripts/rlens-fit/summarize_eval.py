"""Recall@k of each lens on the paper's seven readout layers, from an eval_ranks.csv.

The harness ranks every layer it was given. The paper's metric uses seven layers:
per item, the best rank over those layers for each hidden token, then the share
of hidden tokens with rank <= k, averaged within the item and then over the
task's items. "macro" is the plain mean over the five tasks.

Usage:
  uv run --with pandas python summarize_eval.py <eval_ranks.csv> --layers 8,15,22,30,38,45,52
"""

import argparse

import pandas as pd

MACRO_EVALS = ["association", "multihop", "multilingual", "poetry", "typo"]


def recall_at_k(ranks: pd.DataFrame, k: int) -> pd.DataFrame:
    best = (
        ranks.groupby(["eval", "lens", "item", "intermediate"])["rank"]
        .min()
        .reset_index()
    )
    per_item = (
        best.assign(hit=best["rank"] <= k)
        .groupby(["eval", "lens", "item"])["hit"]
        .mean()
    )
    table = per_item.groupby(["lens", "eval"]).mean().unstack("eval")
    table["macro"] = table.reindex(columns=MACRO_EVALS).mean(axis=1, skipna=False)
    return table


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("ranks_csv")
    parser.add_argument("--layers", required=True)
    parser.add_argument("--ks", default="1,10")
    args = parser.parse_args()

    layers = [int(x) for x in args.layers.split(",")]
    ranks = pd.read_csv(args.ranks_csv)
    missing = sorted(set(layers) - set(ranks["layer"]))
    if missing:
        raise SystemExit(f"layers {missing} are not in {args.ranks_csv}")
    ranks = ranks[ranks["layer"].isin(layers)]
    counts = ranks.groupby("eval")["item"].nunique()
    print("items per task:", counts.to_dict())
    for k in (int(x) for x in args.ks.split(",")):
        print(f"\nrecall@{k} over layers {layers}:")
        print(recall_at_k(ranks, k).round(3).to_string())


if __name__ == "__main__":
    main()
