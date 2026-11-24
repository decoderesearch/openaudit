"""An SAE for SynthSAEBench: one of the paper's published SAEs, in the SAELens format. SYNTH_SAE
selects it (default btk/l0-15/seed-0: BatchTopK, L0 15, seed 0). Its published MCC is 0.6759."""

import os

from huggingface_hub import snapshot_download
from sae_lens import SAE

REPO = "decoderesearch/synth-sae-bench-16k-v1-saes"
REVISION = "a39c0d9691dc4a3d1d11dfb1680fd981cdcca0d9"
NAME = os.environ.get("SYNTH_SAE", "btk/l0-15/seed-0")


def load_sae(device: str):
    local = snapshot_download(
        REPO,
        revision=REVISION,
        allow_patterns=[f"{NAME}/cfg.json", f"{NAME}/sae_weights.safetensors"],
    )
    return SAE.load_from_disk(f"{local}/{NAME}", device=device)
