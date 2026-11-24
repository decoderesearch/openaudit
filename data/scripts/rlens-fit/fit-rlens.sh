#!/usr/bin/env bash
# Fit an R-Lens on a RunPod GPU pod with the jpp_lens harness.
#
# The fit is the jpp_lens LRP fit ("rlens" mode) with a 1-cluster router. Its pooled
# lens is the R-Lens. One cluster keeps each shard checkpoint at layers x d_model^2
# fp32 (about 7 GB), so shards from different pods are small enough to move.
#
# Usage (on the pod, from this folder):
#   ./fit-rlens.sh setup  <hf-model>                 # venv, prompts, weights
#   ./fit-rlens.sh router <hf-model>                 # 1-cluster router
#   ./fit-rlens.sh shard  <hf-model> <idx> <n> [rows] [num-prompts]
#   ./fit-rlens.sh merge  <hf-model> <shard-dir>...  # writes the pooled R-Lens
#   ./fit-rlens.sh convert  <hf-model>               # Neuronpedia format + config.yaml
#   ./fit-rlens.sh grade    <hf-model>               # model correctness on the eval items
#   ./fit-rlens.sh evaluate <hf-model> [ref|rlens|all]  # readout ranks per lens and layer
#   ./fit-rlens.sh samples  <hf-model> [--limit N]      # top tokens and ranks of every item
#   ./fit-rlens.sh probe-swap <hf-model>                # the swap eval at the readout layers
# samples and probe-swap pass more flags to their scripts, e.g. --strip-word-answers.
#
# Each shard covers a contiguous slice of the first <num-prompts> (default 64)
# WikiText-103 prompts. The output is in the jpp_lens format (parameters.jacobians
# + config), which Neuronpedia's convert-jpp-lens.py reads. The eval reads the
# Neuronpedia J-Lens and J++ Lens from neuronpedia/jacobian-lens at NP_REV.
set -euo pipefail

JPP_DIR=${JPP_DIR:-/root/jpp_lens}
JPP_REPO=https://github.com/safety-research/jpp_lens
JPP_COMMIT=d7efc0de372e20589e899188c0cfe8434acc63ec
WORK=${WORK:-/workspace/rlens}
HERE=$(cd "$(dirname "$0")" && pwd)
export HF_HOME=${HF_HOME:-/workspace/hf}
export HF_XET_HIGH_PERFORMANCE=1
export OMP_NUM_THREADS=${OMP_NUM_THREADS:-8}
export PATH="$HOME/.local/bin:$PATH"

NP_REPO=neuronpedia/jacobian-lens
NP_REV=e166deb5ad540932100ef803c8c9bcc2a5453694
NP_CONVERT=${NP_CONVERT:-/root/np/utils/neuronpedia-utils/neuronpedia_utils/jlens/jpp/convert-jpp-lens.py}
NP_GRADE=${NP_GRADE:-/root/np/utils/neuronpedia-utils/neuronpedia_utils/jlens/jpp/grade.py}

stage=${1:?stage: setup | router | shard | merge | convert | grade | evaluate | samples | probe-swap}
model=${2:?hf model name}
slug=$(basename "$model")
mkdir -p "$WORK"

# Neuronpedia model id, J-Lens file name and the paper's seven readout layers. An empty J-Lens
# file name means that Neuronpedia has no J-Lens for the model: the eval uses Camila Blank's.
case "$model" in
google/gemma-4-31B) np_id=gemma-4-31b; jlens_file=gemma-4-31B_jacobian_lens.pt; readout=8,15,22,30,38,45,52 ;;
Qwen/Qwen3.6-27B) np_id=qwen3.6-27b; jlens_file=Qwen3.6-27B_jacobian_lens_n1000.pt; readout=8,16,24,32,40,48,56 ;;
allenai/Olmo-3-1125-32B) np_id=olmo-3-1125-32b; jlens_file=Olmo-3-1125-32B_jacobian_lens.pt; readout=8,16,24,32,40,48,56 ;;
Qwen/Qwen3.5-9B) np_id=qwen3.5-9b; jlens_file=""; readout=4,8,12,16,20,24,28 ;;
Qwen/Qwen3.5-122B-A10B) np_id=qwen3.5-122b-a10b; jlens_file=""; readout=6,12,18,24,30,36,42 ;;
deepseek-ai/DeepSeek-V4-Flash) np_id=deepseek-v4-flash; jlens_file=""; readout=5,11,16,22,27,32,38 ;;
*) np_id=""; jlens_file=""; readout="" ;;
esac
CB_REPO=camilablank/workspace-lenses
CB_REV=d740106d1e0f95456dc8718fba2895e9c8ffd6ef
rlens_np="$WORK/np-export/$np_id/rlens/Salesforce-wikitext/${slug}_rlens.pt"

cli() { (cd "$JPP_DIR" && uv run --extra cu128 python "$HERE/jpp_cli_gpu.py" "$@"); }

# DEVICE_MAP=cuda loads the weights onto the GPU directly. Use it when the model is
# larger than the pod's host RAM. EXPERTS_IMPL=eager selects the per-expert MoE loop:
# the grouped-GEMM kernel fails on B300. DeepSeek-V4 needs ATTN_IMPL=eager.
dm=()
if [ -n "${DEVICE_MAP:-}" ]; then dm+=(--device-map "$DEVICE_MAP"); fi
if [ -n "${EXPERTS_IMPL:-}" ]; then dm+=(--experts-implementation "$EXPERTS_IMPL"); fi
if [ -n "${ATTN_IMPL:-}" ]; then dm+=(--attn-implementation "$ATTN_IMPL"); fi

# Every block but the final one, which is the target.
layers() {
  (cd "$JPP_DIR" && uv run --extra cu128 python -c "
import sys
from transformers import AutoConfig
c = AutoConfig.from_pretrained(sys.argv[1])
c = getattr(c, 'text_config', None) or c
print(','.join(str(i) for i in range(c.num_hidden_layers - 1)))" "$model")
}

# Downloads the reference lenses and sets jlens, jpp and ref_lenses. Without a Neuronpedia
# J-Lens, the J-Lens and an extra R-Lens are Camila Blank's. The lens name is the file stem,
# so her files get links with clear names.
np_dir="$WORK/np-lenses"
cb_dir="$WORK/cb-lenses"
jpp="$np_dir/$np_id/jpp/Salesforce-wikitext/${slug}_jpp_lens.pt"
fetch_ref() {
  local np_files=()
  if [ -n "$jlens_file" ]; then
    jlens="$np_dir/$np_id/jlens/Salesforce-wikitext/$jlens_file"
    np_files=("$np_id/jlens/Salesforce-wikitext/$jlens_file")
    ref_lenses=("$jlens" "$jpp" logit)
  else
    jlens="$cb_dir/${slug}_cb_jlens_n25.pt"
    ref_lenses=("$jlens" "$cb_dir/${slug}_cb_rlens_n25.pt" "$jpp" logit)
  fi
  (cd "$JPP_DIR" && uv run --extra cu128 hf download "$NP_REPO" --revision "$NP_REV" \
    "${np_files[@]}" "$np_id/jpp/Salesforce-wikitext/${slug}_jpp_lens.pt" \
    --local-dir "$np_dir" --quiet >/dev/null)
  if [ -z "$jlens_file" ]; then
    (cd "$JPP_DIR" && uv run --extra cu128 hf download "$CB_REPO" --revision "$CB_REV" \
      "$np_id/j-lens/lens.pt" "$np_id/r-lens/lens.pt" --local-dir "$cb_dir" --quiet >/dev/null)
    ln -sfn "$cb_dir/$np_id/j-lens/lens.pt" "$cb_dir/${slug}_cb_jlens_n25.pt"
    ln -sfn "$cb_dir/$np_id/r-lens/lens.pt" "$cb_dir/${slug}_cb_rlens_n25.pt"
  fi
}

case "$stage" in
setup)
  command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh
  if [ ! -d "$JPP_DIR/.git" ]; then git clone -q "$JPP_REPO" "$JPP_DIR"; fi
  git -C "$JPP_DIR" checkout -q "$JPP_COMMIT"
  (cd "$JPP_DIR" && uv sync -q --extra cu128)
  # The xet download can crash; a retry resumes it.
  (cd "$JPP_DIR" && for try in 1 2 3; do
    uv run --extra cu128 hf download "$model" --quiet >/dev/null && exit 0
    echo "download failed (try $try)" >&2
    sleep 5
  done; exit 1) &
  dl=$!
  if [ ! -s "$WORK/fit_prompts.json" ]; then
    (cd "$JPP_DIR" && uv run --extra cu128 python -c "
import json, sys
sys.path.insert(0, 'scripts')
from jpp_cli import load_fit_prompts
json.dump(load_fit_prompts(64), open(sys.argv[1], 'w'))" "$WORK/fit_prompts.json")
  fi
  wait "$dl"
  (cd "$JPP_DIR" && uv run --extra cu128 python -c "
import shutil, torch
print('torch', torch.__version__, 'cuda', torch.version.cuda, torch.cuda.get_device_name(0))
print('ninja', shutil.which('ninja') or 'not found (the fit does not JIT)')")
  echo "setup done: $model, layers $(layers)"
  ;;
router)
  cli fit-router --hf-model-name "$model" --layers "$(layers)" --num-prompts 64 \
    --num-clusters 1 --out "$WORK/${slug}_router_K1.pt" "${dm[@]}"
  ;;
shard)
  idx=${3:?shard idx}
  n=${4:?num shards}
  rows=${5:-32}
  prompts=${6:-64}
  cli fit-shard --hf-model-name "$model" --layers "$(layers)" \
    --router-path "$WORK/${slug}_router_K1.pt" --shard-idx "$idx" --num-shards "$n" \
    --num-prompts "$prompts" --prompts-json "$WORK/fit_prompts.json" --lrp-mode rlens \
    --jacobian-rows-per-pass "$rows" --artifacts-base-dir "$WORK/artifacts" \
    --checkpoint-name "${slug}_rlens" "${dm[@]}"
  ;;
merge)
  shift 2
  cli merge-experts --checkpoint-dirs "$@" --num-clusters 1 \
    --checkpoint-name "${slug}_rlens" --out "$WORK/${slug}_experts_K1.pt" \
    --pooled-lens-out "$WORK/${slug}_rlens_pooled.pt"
  # With one cluster, the experts file holds the same map as the pooled lens.
  rm -f "$WORK/${slug}_experts_K1.pt"
  ;;
convert)
  (cd "$JPP_DIR" && uv run --extra cu128 python "$NP_CONVERT" "$WORK/${slug}_rlens_pooled.pt" \
    --method rlens --np-model-id "$np_id" --out-dir "$WORK/np-export" \
    --source "OpenAudit R-Lens fit (64 WikiText-103 prompts, jpp_lens@${JPP_COMMIT:0:8})")
  ;;
grade)
  (cd "$JPP_DIR" && uv run --extra cu128 python "$NP_GRADE" --hf-model-name "$model" \
    --layers "$(layers)" --out "$WORK/${slug}_correctness.csv" "${dm[@]}")
  ;;
evaluate)
  # ref: the J-Lens, the Neuronpedia J++ Lens and the logit lens (plus Camila Blank's
  # R-Lens when her J-Lens is used); rlens: our R-Lens; all: both.
  which=${3:-all}
  case "$which" in
  ref) fetch_ref; lenses=("${ref_lenses[@]}") ;;
  rlens) lenses=("$rlens_np") ;;
  all) fetch_ref; lenses=("$rlens_np" "${ref_lenses[@]}") ;;
  *) echo "evaluate: ref | rlens | all" >&2; exit 2 ;;
  esac
  cli evaluate --hf-model-name "$model" --layers "$(layers)" \
    --correctness-csv "$WORK/${slug}_correctness.csv" --lens "${lenses[@]}" \
    --out "$WORK/${slug}_eval_ranks_${which}.csv" "${dm[@]}"
  cat "$WORK/${slug}_eval_ranks_${which}_pass_at_k.csv"
  ;;
samples)
  # Every item: the model's top next tokens, and each lens's top tokens and ranks at each layer.
  # One lens of each kind: our R-Lens if we fitted one, else Camila Blank's.
  fetch_ref
  if [ -f "$rlens_np" ]; then rlens=("$rlens_np"); else rlens=("$cb_dir/${slug}_cb_rlens_n25.pt"); fi
  lenses=("${rlens[@]}" "$jlens" "$jpp" logit)
  (cd "$JPP_DIR" && uv run --extra cu128 python "$HERE/readout_samples.py" --model "$model" \
    --layers "$(layers)" --correctness-csv "$WORK/${slug}_correctness.csv" --lens "${lenses[@]}" \
    --out "$WORK/${slug}_readout_samples.jsonl.gz" "${dm[@]}" "${@:3}")
  ;;
probe-swap)
  # The same lenses as samples. The edits are at the readout layers, at each harness scale.
  fetch_ref
  if [ -f "$rlens_np" ]; then rlens=("$rlens_np"); else rlens=("$cb_dir/${slug}_cb_rlens_n25.pt"); fi
  (cd "$JPP_DIR" && uv run --extra cu128 python "$HERE/probe_swap.py" --model "$model" \
    --layers "${readout:?no readout layers for $model}" --lens "${rlens[@]}" "$jlens" "$jpp" logit \
    --out-dir "$WORK/probe-swap" "${dm[@]}" "${@:3}")
  ;;
*)
  echo "unknown stage: $stage" >&2
  exit 2
  ;;
esac
