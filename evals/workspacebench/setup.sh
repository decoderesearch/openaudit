#!/usr/bin/env bash
# Gets the workspace-bench commit of an instrument version, applies its OpenAudit patch and makes
# its Python environment. Each commit has its own checkout in WSB_ROOT (default .workspace-bench
# in this folder).
#   ./setup.sh                     # the default version
#   ./setup.sh --version <version>
# Needs git, uv, python3 and a CUDA GPU.
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
WSB_REPO=https://github.com/camilablank/workspace-bench
version=""
case "${1:-}" in
  --version) version=${2:?--version needs a value} ;;
  --version=*) version=${1#--version=} ;;
  "") ;;
  *) echo "usage: ./setup.sh [--version <version>]" >&2; exit 2 ;;
esac
pin=$(python3 "$HERE/pin.py" "$version")
read -r VERSION WSB_COMMIT PATCH WSB_DIR <<< "$pin"

if [ ! -d "$WSB_DIR/.git" ]; then
  git clone --quiet "$WSB_REPO" "$WSB_DIR"
fi
git -C "$WSB_DIR" fetch --quiet origin "$WSB_COMMIT" 2>/dev/null || true
git -C "$WSB_DIR" checkout --quiet --force "$WSB_COMMIT"
git -C "$WSB_DIR" checkout --quiet -- src tests
git -C "$WSB_DIR" clean --quiet -fd -- src tests
git -C "$WSB_DIR" apply "$PATCH"
cd "$WSB_DIR"
uv sync --extra gpu
# Fast kernels for the linear-attention layers of Qwen3.6 (without them, a run is about 3x slower).
uv pip install --quiet flash-linear-attention==0.6.0
echo "version $VERSION: workspace-bench $WSB_COMMIT (with $(basename "$PATCH")) is in $WSB_DIR"
