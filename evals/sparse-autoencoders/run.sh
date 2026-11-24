#!/usr/bin/env bash
# Runs one SAE suite. The first argument is the suite; the others go to its script:
#   ./run.sh synth --sae examples/synth_published_sae.py --out out/btk        # SynthSAEBench-16k
#   ./run.sh saebench --sae my_sae.py --model EleutherAI/pythia-160m-deduped --out out/my-sae
#   ./run.sh icalens --seed 0 --out out/icalens/seed-0                       # ICA Lens baseline, synth
# synth: the pinned packages of synth.py.lock. saebench: the SAEBench environment of setup.sh.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
SUITE=${1:-}
shift || true
case "$SUITE" in
  synth)
    exec uv run --script "$HERE/synth.py" "$@"
    ;;
  saebench)
    export SAEBENCH_DIR=${SAEBENCH_DIR:-$HERE/.saebench}
    SAEBENCH_COMMIT=$(sed -n 's/^SAEBENCH_COMMIT=//p' "$HERE/setup.sh")
    if [ ! -d "$SAEBENCH_DIR/.git" ] || [ "$(git -C "$SAEBENCH_DIR" rev-parse HEAD)" != "$SAEBENCH_COMMIT" ]; then
      echo "no SAEBench $SAEBENCH_COMMIT in $SAEBENCH_DIR: run ./setup.sh first" >&2
      exit 1
    fi
    exec "$SAEBENCH_DIR/.venv/bin/python" "$HERE/saebench.py" "$@"
    ;;
  icalens)
    exec "$HERE/icalens/run.sh" "$@"
    ;;
  *)
    echo "usage: ./run.sh synth|saebench|icalens <arguments>" >&2
    exit 2
    ;;
esac
