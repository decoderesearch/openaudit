#!/usr/bin/env bash
# Runs run.py with its pinned packages (run.py.lock). All arguments go to run.py:
#   ./run.sh --detector examples/flag_none.py --model google/gemma-4-E4B-it --limit 50 --out out/smoke  # smoke run
#   ./run.sh --detector my_detector.py --model google/gemma-4-E4B-it --out out/my-detector             # full run
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
exec uv run --script "$HERE/run.py" "$@"
