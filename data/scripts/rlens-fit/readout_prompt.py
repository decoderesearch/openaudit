"""Print the top readout tokens of many lenses for one prompt, with and without Readout Filtering.

The model loads once. Each lens is a .pt path (either lens format) or 'logit'. The default
prompt is the Figure 1 prompt of the J++ Lens paper.

Usage (from the jpp_lens root):
  uv run --extra cu128 python readout_prompt.py --lens a.pt b.pt logit --out readouts.json
"""

import argparse
import json
import sys
from pathlib import Path

sys.modules["fla"] = None
sys.path.insert(0, "scripts")

from lens_evals.readout_evals.readout_eval_items import (
    load_readout_eval_items,
    non_semantic_token_ids,
)
from quickstart import DEFAULT_PROMPT, read_out_prompt
from workspace_lens import get_hf_model
from workspace_lens.config import (
    QWEN3_6_27B_RECIPE_READOUT_LAYERS,
    LensConfig,
)
from workspace_lens.lenses.logit_lens import LogitLens
from workspace_lens.utils import load_lens_file, vocab_size_of


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lens", nargs="+", required=True)
    parser.add_argument("--model", default="Qwen/Qwen3.6-27B")
    parser.add_argument("--prompt", default=DEFAULT_PROMPT)
    parser.add_argument(
        "--layers", default=",".join(map(str, QWEN3_6_27B_RECIPE_READOUT_LAYERS))
    )
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    layers = [int(x) for x in args.layers.split(",")]

    model = get_hf_model(args.model, attn_implementation="sdpa")
    filtered = non_semantic_token_ids(
        model.tokenizer,
        vocab_size=vocab_size_of(model),
        items=load_readout_eval_items(),
    )
    out = {"prompt": args.prompt, "layers": layers, "lenses": {}}
    for spec in args.lens:
        if spec == "logit":
            config = LensConfig(
                hf_model_name=args.model,
                checkpoint_name="logit",
                lens_type="logit",
                d_model=model.d_model,
            )
            name, lens = "logit", LogitLens(source_layers=layers, config=config)
        else:
            name, lens = Path(spec).stem, load_lens_file(spec, hf_model_name=args.model)
        out["lenses"][name] = {}
        for mode, excluded in (("full", []), ("filtered", filtered)):
            readouts = read_out_prompt(
                model,
                lens,
                args.prompt,
                layers=layers,
                top_k=args.top_k,
                excluded_token_ids=excluded,
            )
            tokens = {
                layer: [model.tokenizer.decode([i]) for i in ids]
                for layer, ids in readouts.lens_top_ids_L_dict.items()
            }
            out["lenses"][name][mode] = tokens
            print(f"== {name} ({mode})")
            for layer, top in tokens.items():
                print(f"  {layer:>2}: {top}")
    Path(args.out).write_text(json.dumps(out, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
