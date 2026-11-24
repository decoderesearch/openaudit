"""An example `.py` reader: the logit lens. Copy it and change `read` (or `read_batch`).

  ./run.sh --lens examples/logit_lens_reader.py --out out/logit-lens
"""

from __future__ import annotations

import torch
from wsbench.produce.methods import Readout
from wsbench.produce.render import display_tokens


class LogitLens:
    name = "logit_lens_example"
    layers = None  # None: the layers of the read plan

    def bind(self, backend) -> None:
        # backend: .model, .tokenizer, .device, .n_layers, .unembed (W_U), .final_norm
        self.b = backend
        self.w_u = backend.unembed.detach().float()

    def read_batch(self, hs: torch.Tensor, layer: int) -> list[Readout]:
        """The readouts of many residual vectors `hs` [n, d] at one layer."""
        with torch.no_grad():
            logits = self.b.final_norm(hs.to(self.b.device).float()) @ self.w_u.T
            vals, ids = torch.topk(logits, 10, dim=-1)
        return [
            Readout(tokens=display_tokens(self.b.tokenizer, i.tolist()), scores=v.tolist())
            for i, v in zip(ids, vals, strict=True)
        ]

    def read(self, h: torch.Tensor, layer: int) -> Readout:
        """The readout of one residual vector `h` [d]. A text reader returns
        Readout(samples=[...]) instead of tokens and scores."""
        return self.read_batch(h[None], layer)[0]


def load_reader(model_name: str) -> LogitLens:
    return LogitLens()
