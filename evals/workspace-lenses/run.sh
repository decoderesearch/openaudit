#!/usr/bin/env bash
# Runs run.py in the jpp_lens environment of setup.sh. All arguments go to run.py:
#   ./run.sh --lens my_lens.pt --out out/my-lens                      # smoke tier
#   ./run.sh --lens my_lens.pt --model Qwen/Qwen3.6-27B --out out/my-lens  # full tier
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
export JPP_DIR=${JPP_DIR:-$HERE/.jpp_lens}
JPP_COMMIT=$(sed -n 's/^JPP_COMMIT=//p' "$HERE/setup.sh")

if [ ! -d "$JPP_DIR/.git" ]; then
  echo "no jpp_lens in $JPP_DIR: run ./setup.sh first" >&2
  exit 1
fi
if [ "$(git -C "$JPP_DIR" rev-parse HEAD)" != "$JPP_COMMIT" ]; then
  echo "$JPP_DIR is not at $JPP_COMMIT: run ./setup.sh again" >&2
  exit 1
fi
exec uv run --project "$JPP_DIR" --extra cu128 python "$HERE/run.py" "$@"
