#!/usr/bin/env bash
# Runs run.py with its pinned packages (run.py.lock). All arguments go to run.py:
#   ./run.sh --detector examples/aisi_probe.py --limit 100 --out out/apollo        # smoke run, Qwen/Qwen3-4B
#   ./run.sh --detector my_detector.py --model Qwen/Qwen3-8B --out out/my-detector  # full run
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
exec uv run --script "$HERE/run.py" "$@"
