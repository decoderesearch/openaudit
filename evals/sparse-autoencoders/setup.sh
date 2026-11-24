#!/usr/bin/env bash
# Gets SAEBench at the pinned commit and makes its venv in .saebench (about 6 GB). Run it once,
# before ./run.sh saebench. SAEBENCH_DIR sets a different folder.
set -euo pipefail

SAEBENCH_COMMIT=c681fd875b7a7f8c08b5f9f53bbae69db2dd5661
HERE=$(cd "$(dirname "$0")" && pwd)
DIR=${SAEBENCH_DIR:-$HERE/.saebench}
INDEX=(--index-url https://pypi.org/simple --extra-index-url https://download.pytorch.org/whl/cu128 --index-strategy unsafe-best-match)

[ -d "$DIR/.git" ] || git clone -q https://github.com/adamkarvonen/SAEBench "$DIR"
git -C "$DIR" cat-file -e "$SAEBENCH_COMMIT^{commit}" 2>/dev/null || git -C "$DIR" fetch -q origin
git -C "$DIR" -c advice.detachedHead=false checkout -q "$SAEBENCH_COMMIT"
[ -x "$DIR/.venv/bin/python" ] || uv venv -q -p 3.11 "$DIR/.venv"
uv pip sync -q --python "$DIR/.venv/bin/python" "${INDEX[@]}" "$HERE/saebench-requirements.txt"
uv pip install -q --python "$DIR/.venv/bin/python" --no-deps -e "$DIR"
"$DIR/.venv/bin/python" -c "import torch, sae_bench; print('SAEBench ready: torch', torch.__version__, 'cuda', torch.cuda.is_available())"
