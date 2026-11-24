#!/usr/bin/env bash
# Gets the pinned jpp_lens commit (the eval code of our runs) and its Python environment.
# JPP_DIR: where to put it (default .jpp_lens in this folder). Needs git, uv and a CUDA 12.8 GPU.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
JPP_REPO=https://github.com/safety-research/jpp_lens
JPP_COMMIT=d7efc0de372e20589e899188c0cfe8434acc63ec
JPP_DIR=${JPP_DIR:-$HERE/.jpp_lens}

if [ ! -d "$JPP_DIR/.git" ]; then
  git clone --quiet "$JPP_REPO" "$JPP_DIR"
fi
git -C "$JPP_DIR" fetch --quiet origin "$JPP_COMMIT" 2>/dev/null || true
git -C "$JPP_DIR" checkout --quiet "$JPP_COMMIT"
(cd "$JPP_DIR" && uv sync --extra cu128)
echo "jpp_lens $JPP_COMMIT is in $JPP_DIR"
