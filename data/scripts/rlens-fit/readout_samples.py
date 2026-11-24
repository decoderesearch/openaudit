"""Write the sample data of the Workspace Lens Readout eval for one model, as JSON lines.

Each item of the five macro evals gets one line, also the items that the scores leave out. A line
has the item, the token at its readout position, the model's top next tokens and its grade, and
for each lens at each layer the top tokens (with Readout Filtering) and the rank of each hidden
token. `scored` is true for the items that `evaluate` scores: correct or ungradeable, with a
single-token candidate, and in the held-out split. Ranks are computed as in the harness, so they
equal the `evaluate` ranks of the scored items.

The first line is a header with the model, the layers and the lens files. Usage (from the jpp_lens
root):
  uv run --extra cu128 python readout_samples.py --model Qwen/Qwen3.6-27B --layers 0,1,...,62 \
    --correctness-csv Qwen3.6-27B_correctness.csv --lens a.pt b.pt logit --out samples.jsonl.gz
"""

import argparse
import dataclasses
import gzip
import json
import logging
import sys
import time

import torch as t

sys.path.insert(0, "scripts")

from jpp_cli import LOGIT_LENS_SPEC, load_lenses
from lens_evals.eval_utils import next_token_matches_target
from lens_evals.readout_evals.readout_eval_items import (
    DEFAULT_FIT_FRACTION,
    MACRO_EVALS,
    filter_items_by_correctness,
    load_readout_eval_items,
    non_semantic_token_ids,
    split_fitting_items,
)
from lens_evals.readout_evals.readout_evals import (
    ReadoutEvalRunner,
    _item_readout_and_candidates,
)
from strip_rule import fixed_prompt
from workspace_lens import get_hf_model
from workspace_lens.utils import (
    check_model_matches_config,
    final_position_model_logits,
    model_device_of,
    record_activations,
    token_id_mask_Bool_V,
    vocab_size_of,
)

MAX_SEQ_LEN = 512
SPLIT_SEED = 0

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
logger = logging.getLogger("readout_samples")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--layers", required=True)
    parser.add_argument("--correctness-csv", required=True)
    parser.add_argument("--lens", nargs="+", required=True)
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--model-top-k", type=int, default=5)
    parser.add_argument(
        "--limit", type=int, default=None, help="only the first N items (a test)"
    )
    parser.add_argument("--out", required=True)
    parser.add_argument(
        "--strip-word-answers",
        action="store_true",
        help="read without the prompt's trailing space unless the answer is a number (strip_rule.py)",
    )
    parser.add_argument(
        "--device-map",
        default=None,
        help="e.g. 'auto' for a model on more than one GPU",
    )
    parser.add_argument("--attn-implementation", default="sdpa")
    parser.add_argument(
        "--experts-implementation",
        default=None,
        help="HF MoE experts path, e.g. 'eager'",
    )
    args = parser.parse_args()
    layers = [int(x) for x in args.layers.split(",")]

    model = get_hf_model(
        args.model,
        attn_implementation=args.attn_implementation,
        device_map=args.device_map,
        experts_implementation=args.experts_implementation,
    )
    lenses = load_lenses(args.lens, model, hf_model_name=args.model, layers=layers)
    for lens in lenses.values():
        check_model_matches_config(model, lens.config)
    write_samples(
        model,
        lenses,
        layers,
        model_name=args.model,
        correctness_csv=args.correctness_csv,
        out_path=args.out,
        lens_files=args.lens,
        strip_word_answers=args.strip_word_answers,
        limit=args.limit,
        top_k=args.top_k,
        model_top_k=args.model_top_k,
    )


def write_samples(
    model,
    lenses: dict,
    layers: list[int],
    *,
    model_name: str,
    correctness_csv: str,
    out_path: str,
    lens_files: list[str],
    strip_word_answers: bool,
    limit: int | None = None,
    top_k: int = 10,
    model_top_k: int = 5,
) -> None:
    """Writes the sample file of `lenses` (`{name: lens}`) on `model`. `lens_files`: the source of
    each lens, for the header. The harness in evals/workspace-lenses calls this too."""
    args = argparse.Namespace(top_k=top_k, model_top_k=model_top_k)
    runner = ReadoutEvalRunner(model, lenses, layers=layers, max_seq_len=MAX_SEQ_LEN)
    excluded = non_semantic_token_ids(
        model.tokenizer,
        vocab_size=vocab_size_of(model),
        items=load_readout_eval_items(),
    )
    excluded_mask = token_id_mask_Bool_V(excluded, vocab_size_of(model)).to(
        model_device_of(model)
    )

    items = load_readout_eval_items(slugs=MACRO_EVALS)
    kept = filter_items_by_correctness(
        items, hf_model_name=model_name, correctness_csv=correctness_csv
    )
    fit, held_out = split_fitting_items(
        runner.scoreable_items(kept), seed=SPLIT_SEED, fit_fraction=DEFAULT_FIT_FRACTION
    )
    split = {(i.eval_slug, i.name): "fit" for i in fit}
    split |= {(i.eval_slug, i.name): "held-out" for i in held_out}
    if strip_word_answers:
        # After the split, so that each item stays on its side.
        items = [with_strip_rule(model.tokenizer, i) for i in items]
    if limit:
        items = items[:limit]

    header = {
        "model": model_name,
        "layers": layers,
        "lenses": dict(zip(lenses, lens_files, strict=True)),
        "top_k": top_k,
        "readout_filter": True,
        "num_excluded_token_ids": len(excluded),
        "split_seed": SPLIT_SEED,
        "fit_fraction": DEFAULT_FIT_FRACTION,
        "max_seq_len": MAX_SEQ_LEN,
        "strip_word_answers": strip_word_answers,
    }
    start = time.time()
    with (
        gzip.open(out_path, "wt") if out_path.endswith(".gz") else open(out_path, "w")
    ) as out:
        out.write(json.dumps({"header": header}, ensure_ascii=False) + "\n")
        for n, item in enumerate(items, 1):
            row = item_row(model, lenses, item, layers, excluded_mask, split, args)
            out.write(json.dumps(row, ensure_ascii=False) + "\n")
            if n % 25 == 0 or n == len(items):
                logger.info("item %d/%d, %.0fs", n, len(items), time.time() - start)
    logger.info(
        "wrote %s (%s)", out_path, ", ".join(n for n in lenses if n != LOGIT_LENS_SPEC)
    )


def with_strip_rule(tokenizer, item):
    answer = item.correctness_target() or item.intermediates[0]
    return dataclasses.replace(item, prompt=fixed_prompt(tokenizer, item.prompt, [answer]))


@t.no_grad()
def item_row(model, lenses, item, layers, excluded_mask, split, args) -> dict:
    """One item's line. `split`: the fit or held-out split of each scoreable, kept item."""
    tok = model.tokenizer

    def decode(ids):
        return [tok.decode([int(i)]) for i in ids]

    key = (item.eval_slug, item.name)
    model_logits = final_position_model_logits(model, item.prompt, MAX_SEQ_LEN)
    top = model_logits.softmax(-1).topk(args.model_top_k)
    target = item.correctness_target()
    next_token = tok.decode([int(model_logits.argmax())])
    row = {
        "eval": item.eval_slug,
        "item": item.name,
        "prompt": item.prompt,
        "target": item.target,
        "intermediates": list(item.intermediates),
        "model_top": [
            [s, round(float(p), 4)]
            for s, p in zip(decode(top.indices), top.values, strict=True)
        ],
        "correct": None
        if target is None
        else next_token_matches_target(next_token, target),
        "split": split.get(key),
        "scored": split.get(key) == "held-out",
    }
    readout = _item_readout_and_candidates(model, item, MAX_SEQ_LEN)
    if readout is None:
        return row | {"dropped": list(item.intermediates)}
    row["dropped"] = list(readout.dropped_intermediates)
    position = readout.readout_position
    row["readout_token"] = tok.decode([int(readout.input_ids_Int_1S[0, position])])
    _, acts = record_activations(model, item.prompt, MAX_SEQ_LEN, layers)
    row["lenses"] = {}
    for name, lens in lenses.items():
        ranks = {k: [] for k in readout.candidate_ids_by_intermediate}
        tops = []
        for layer in layers:
            residual = acts[layer][[position]].float()
            logits = model.unembed(lens.transport(residual, layer)).float()[0]
            logits = logits.masked_fill(excluded_mask.to(logits.device), float("-inf"))
            tops.append(decode(logits.topk(args.top_k).indices))
            for k, ids in readout.candidate_ids_by_intermediate.items():
                best = logits[list(ids)].max()
                ranks[k].append(int((logits > best).sum()) + 1)
        row["lenses"][name] = {"top": tops, "ranks": ranks}
    return row


if __name__ == "__main__":
    main()
