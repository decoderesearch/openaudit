"""Writes a J-format lens with J = I at each read layer: the logit lens. Use it to check your setup.

  uv run --no-sync --project .workspace-bench/2617613 python examples/make_identity_lens.py \
      --model Qwen/Qwen3.5-0.8B --out out/identity-0.8b.pt
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import torch
from transformers import AutoConfig

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from run import read_layers  # noqa: E402


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--model", default="Qwen/Qwen3.5-0.8B")
    p.add_argument("--out", required=True)
    args = p.parse_args()
    cfg = AutoConfig.from_pretrained(args.model)
    cfg = getattr(cfg, "text_config", None) or cfg
    layers = read_layers(args.model, cfg.num_hidden_layers)
    if layers is None:
        from wsbench.readplan import GRID

        layers = GRID
    eye = torch.eye(cfg.hidden_size, dtype=torch.bfloat16)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    torch.save({"J": {layer: eye for layer in layers}, "model": args.model}, args.out)
    print(f"wrote {args.out}: J = I at layers {layers}")


if __name__ == "__main__":
    main()
