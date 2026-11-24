#!/usr/bin/env bash
# Runs our lenses (lenses.json: the J-Lens, the J++ Lens and the Oracle Lens) on Qwen3.6-27B with
# the default version and the Batch API. Each lens goes to out/ours-<version>/<lens>.
#   ./run_ours.sh                         # all three lenses
#   LENSES=jlens,jpp ./run_ours.sh        # some of them
#   ./run_ours.sh --produce-only          # other arguments go to run.py
# Needs ANTHROPIC_API_KEY and OPENROUTER_API_KEY (not for --produce-only).
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
read -r VERSION _ _ WSB_DIR <<< "$(python3 "$HERE/pin.py")"
for a in "$@"; do
  case "$a" in --version|--version=*|--lens|--lens=*|--readout|--readout=*|--model|--model=*)
    echo "run_ours.sh sets $a itself" >&2; exit 2 ;;
  esac
done
lenses=${LENSES:-jlens,jpp,olens}
for lens in ${lenses//,/ }; do
  spec=$(python3 -c "import json,sys; print(json.dumps(json.load(open('$HERE/lenses.json'))['$lens']))")
  reader=$(python3 -c "import json,sys; print(json.loads(sys.argv[1]).get('reader', ''))" "$spec")
  args=()
  if [ -n "$reader" ]; then
    path=$HERE/$reader
  else
    path=$(uv run --no-sync --project "$WSB_DIR" python -c "
import json, sys
from huggingface_hub import hf_hub_download
s = json.loads(sys.argv[1])
print(hf_hub_download(s['repo'], s['file'], revision=s['revision']))" "$spec")
    args=(--readout "$(python3 -c "import json,sys; print(json.loads(sys.argv[1])['readout'])" "$spec")")
  fi
  out=${OUT_ROOT:-$HERE/out/ours-$VERSION}/$lens
  echo "== $lens: $(basename "$path") -> $out"
  "$HERE/run.sh" --version "$VERSION" --lens "$path" "${args[@]}" --model Qwen/Qwen3.6-27B \
    --batch --out "$out" "$@"
done
