"""An ICA Lens as a SAELens StandardSAE, for ./run.sh synth. ICALENS_LENS is the lens folder of
fit.py. The formula is the one of Neuronpedia's ICA Lens converter:
W_enc = (s*n*R).T, b_enc = 0, W_dec = (W*s/n).T, b_dec = center. R and W are the reading and
writing matrices, n the norm of each column of W, and s the tail sign of each component. ReLU keeps
the long tail of each score, and the rows of W_dec have norm 1."""

import json
import os
from pathlib import Path

import torch
from sae_lens import StandardSAE, StandardSAEConfig
from safetensors.torch import load_file


def load_sae(device: str):
    lens = Path(os.environ["ICALENS_LENS"])
    manifest = json.loads((lens / "icalens.json").read_text())
    prep = manifest["input_preprocessing"]
    if prep["icalens_preprocessing"] != "none":
        raise SystemExit(
            f"preprocessing {prep['icalens_preprocessing']!r}: the encoder is not linear"
        )
    t = load_file(str(lens / manifest["layers"]["0"]["file"]))
    reading, writing, center = (
        t[k].float() for k in ("reading_matrix", "writing_matrix", "center")
    )
    signs = torch.tensor(json.loads((lens / "signs.json").read_text())["signs"])
    norms = writing.norm(dim=0)
    d_sae, d_in = reading.shape
    sae = StandardSAE(
        StandardSAEConfig(
            d_in=d_in,
            d_sae=d_sae,
            dtype="float32",
            device="cpu",
            apply_b_dec_to_input=True,
        )
    )
    sae.load_state_dict(
        {
            "W_enc": ((signs * norms)[:, None] * reading).T.contiguous(),
            "b_enc": torch.zeros(d_sae),
            "W_dec": (writing * (signs / norms)[None, :]).T.contiguous(),
            "b_dec": center.clone(),
        }
    )
    return sae.to(device)
