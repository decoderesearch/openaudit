#!/bin/bash
# Runs varied-deception-probes.py for each "<subset> <model> [budget] [variants] [packages]" line of
# a queue file, one after another. Writes a log for each model, and DONE when all are finished.
# packages: extra packages for the probe pass, with commas, e.g. "transformers<5,protobuf".
#   data/scripts/varied-deception-probes-queue.sh <queue file> [variants]
# DYL=1: first ask the DYL follow-ups (varied-deception-dyl.py, unless they exist), then score
# them (--generated).
# GPU_MEMORY: the vLLM GPU memory share (default 0.85). TP: the vLLM tensor-parallel GPUs (default 1).
# CLEANUP=1: delete each model from the Hugging Face cache after its run (for pods only).
# PARTIAL=1: load only the blocks that the probes read (--partial).
set -u
cd "$(dirname "$0")/../.."
queue=$1
default=${2:-apollo,targeted-apollo}
logs=data/cache/varied-deception/probe-logs
mkdir -p "$logs"
while read -r subset model budget variants packages; do
  [ -z "$subset" ] && continue
  variants=${variants:-$default}
  extra=()
  for p in ${packages//,/ }; do extra+=(--with "$p"); done
  log=$logs/$subset.log
  : > "$log"
  echo "$(date -u +%FT%TZ) start $model $variants" >> "$logs/queue.log"
  rc=0
  if [ -n "${DYL:-}" ] && ! ls data/cache/varied-deception/dyl/"$subset"/*.parquet >/dev/null 2>&1; then
    uv run data/scripts/varied-deception-dyl.py --subset "$subset" --model "$model" \
      --variants "$(tr , "\n" <<< "$variants" | grep "^dyl" | paste -sd,)" ${GPU_MEMORY:+--gpu-memory "$GPU_MEMORY"} ${TP:+--tp "$TP"} >> "$log" 2>&1
    rc=$?
  fi
  if [ "$rc" -eq 0 ]; then
    uv run "${extra[@]}" data/scripts/varied-deception-probes.py --subset "$subset" --model "$model" \
      --variants "$variants" --budget "${budget:-16384}" ${DYL:+--generated} ${CLEANUP:+--cleanup} \
      ${PARTIAL:+--partial} >> "$log" 2>&1
    rc=$?
  fi
  if [ -n "${CLEANUP:-}" ]; then
    rm -rf "data/cache/varied-deception/models/${model//\//--}" "$HOME/.cache/huggingface/hub/models--${model//\//--}"
  fi
  echo "$(date -u +%FT%TZ) exit $rc $model" >> "$logs/queue.log"
done < "$queue"
touch "$logs/DONE"
