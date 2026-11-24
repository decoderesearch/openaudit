"""The Oracle Lens (a text lens) of OpenAudit's run, as a `.py` reader. Only for Qwen3.6-27B.

  ./run.sh --lens examples/oracle_lens_reader.py --model Qwen/Qwen3.6-27B --out out/oracle-lens

It writes one text sample for each cell, so it takes much more GPU time than a token lens.
"""

from __future__ import annotations

from huggingface_hub import snapshot_download
from wsbench.produce.methods import OLens

REPO = "agu18dec/olens_and_ar"
REVISION = "74e9dcdceafa3f14c38e223b5217ca9db44b3cba"
ADAPTER = "olens_s3d_rl600"


def load_reader(model_name: str) -> OLens:
    if model_name != "Qwen/Qwen3.6-27B":
        raise SystemExit("the Oracle Lens adapter is for Qwen/Qwen3.6-27B")
    local = snapshot_download(REPO, revision=REVISION, allow_patterns=[f"{ADAPTER}/*"])
    return OLens(lora=f"{local}/{ADAPTER}")
