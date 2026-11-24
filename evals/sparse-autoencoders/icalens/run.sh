#!/usr/bin/env bash
# The ICA Lens baseline on SynthSAEBench-16k, for one fit seed: sample, fit, then the synth eval.
#   ./run.sh icalens --seed 0 --out out/icalens/seed-0 [--fit-samples N] [--max-iter N] [--samples N]
# --samples goes to synth.py (fewer eval samples: a smoke run). Writes <out>/lens/ and
# <out>/results.json; the fit activations are deleted after the fit.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SEED=0 OUT="" FIT_SAMPLES=1000000 MAX_ITER=200 EVAL_ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --seed) SEED=$2; shift 2 ;;
    --out) OUT=$2; shift 2 ;;
    --fit-samples) FIT_SAMPLES=$2; shift 2 ;;
    --max-iter) MAX_ITER=$2; shift 2 ;;
    --samples) EVAL_ARGS+=(--samples "$2"); shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$OUT" ] || { echo "--out is required" >&2; exit 2; }
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
ACTS="$OUT/acts.safetensors"
trap 'rm -f "$ACTS"' EXIT

uv run --script "$HERE/sample.py" --seed "$SEED" --n "$FIT_SAMPLES" --out "$ACTS"
uv run --script "$HERE/fit.py" --acts "$ACTS" --seed "$SEED" --max-iter "$MAX_ITER" --out "$OUT/lens"
rm -f "$ACTS"
ICALENS_LENS="$OUT/lens" uv run --script "$HERE/../synth.py" \
  --sae "$HERE/icalens_sae.py" --out "$OUT" "${EVAL_ARGS[@]}"
