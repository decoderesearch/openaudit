"""An activation detector: one of AISI's released probes for the subject model. AISI_PROBE selects
the probe: apollo (the default) or targeted-apollo. The probe reads the mean of the reply's text
tokens at its layer. With apollo on Qwen/Qwen3-4B, the balanced accuracy is about 0.65 (the paper:
0.64)."""

import os

import torch
from lie_detectors import get_probe

VARIANT = os.environ.get("AISI_PROBE", "apollo")


class AisiProbe:
    def __init__(self, model_name: str) -> None:
        subset = model_name.lower().replace("/", "-")
        self.probe = get_probe(f"ai-safety-institute/{VARIANT}-{subset}").to("cuda")
        self.layers = [self.probe.layer]
        self.threshold = float(self.probe.threshold)

    @torch.no_grad()
    def score(self, acts, chat) -> float:
        return float(self.probe(acts[self.layers[0]].mean(0)))


def load_detector(model_name: str) -> AisiProbe:
    return AisiProbe(model_name)
