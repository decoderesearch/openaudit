#!/usr/bin/env bash
# Runs run.py in the workspace-bench environment that setup.sh made for the version (--version,
# else the default version). All arguments go to run.py:
#   ./run.sh --lens my_lens.pt --out out/my-lens                          # smoke tier
#   ./run.sh --lens my_lens.pt --model Qwen/Qwen3.6-27B --out out/my-lens  # full tier
set -euo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
version=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --version) version=${args[$((i + 1))]:-} ;;
    --version=*) version=${args[$i]#--version=} ;;
  esac
done
pin=$(python3 "$HERE/pin.py" "$version")
read -r VERSION WSB_COMMIT PATCH WSB_DIR <<< "$pin"
fix="run ./setup.sh --version $VERSION"

if [ ! -d "$WSB_DIR/.git" ]; then
  echo "no workspace-bench in $WSB_DIR: $fix" >&2
  exit 1
fi
if [ "$(git -C "$WSB_DIR" rev-parse HEAD)" != "$WSB_COMMIT" ]; then
  echo "$WSB_DIR is not at $WSB_COMMIT: $fix" >&2
  exit 1
fi
if ! git -C "$WSB_DIR" apply --reverse --check "$PATCH" 2>/dev/null; then
  echo "$WSB_DIR does not have $(basename "$PATCH"): $fix" >&2
  exit 1
fi
exec uv run --no-sync --project "$WSB_DIR" python "$HERE/run.py" "$@"
