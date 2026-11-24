#!/usr/bin/env bash
# Runs a command from a submission (a harness run, a task, tests) with an empty environment: only
# PATH, HOME, the caches, the GPU settings and the variables of --allow. Use it on a new pod that
# has no secrets: submitted code can read each file on the machine, so the script stops when it
# finds one (an .env file that git does not track, or a known credential file in HOME).
#   submissions/run-isolated.sh [--allow NAME]... -- <command> [args]
#   submissions/run-isolated.sh --allow HF_TOKEN -- evals/varied-deception/run.sh --detector d.py --out out/x
#   submissions/run-isolated.sh --allow HF_TOKEN -- evals/varied-deception/run.sh --recipe submissions/<method>/<variant>/code/recipe.py --model M --out out/x
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
# Never pass these: our database, storage, deploy, payment and sign-in keys.
SECRET='DATABASE|DIRECT_URL|POSTGRES|R2_|CLOUDFLARE|WRANGLER|NEON|STRIPE|AUTH|SECRET|RESEND|UPSTASH|RUNPOD|GITHUB|(^|_)GH_|AWS|DEPLOY|QUEUE|NOTIFY'
# The judge keys (OPENROUTER_API_KEY and others) and HF_TOKEN can go with --allow: give a key with a
# spend limit and a read-only token, made for this run.

allow=()
while [ $# -gt 0 ]; do
  case "$1" in
    --allow)
      name=${2:?--allow needs a variable name}
      if [[ ! $name =~ ^[A-Z_][A-Z0-9_]*$ ]]; then
        echo "--allow $name: not a variable name" >&2
        exit 2
      fi
      if [[ $name =~ $SECRET ]]; then
        echo "--allow $name: one of our secrets. Do not give it to submitted code." >&2
        exit 2
      fi
      allow+=("$name")
      shift 2
      ;;
    --) shift; break ;;
    *) echo "usage: $0 [--allow NAME]... -- <command> [args]" >&2; exit 2 ;;
  esac
done
[ $# -gt 0 ] || { echo "usage: $0 [--allow NAME]... -- <command> [args]" >&2; exit 2; }

found=()
while IFS= read -r f; do
  git -C "$ROOT" ls-files --error-unmatch -- "$f" >/dev/null 2>&1 || found+=("$f")
done < <(cd "$ROOT" && find . -name '.env*' -type f -not -path '*/node_modules/*' -not -path '*/.venv/*' -not -path './.git/*' | sed 's|^\./||')
for f in .aws/credentials .config/gh/hosts.yml .netrc .git-credentials .wrangler .config/.wrangler .cloudflared .runpod/config.toml \
  .cache/huggingface/token .docker/config.json .pypirc .npmrc .ssh/id_rsa .ssh/id_ecdsa .ssh/id_ed25519; do
  [ -e "$HOME/$f" ] && found+=("~/$f")
done
[ -n "${HF_HOME:-}" ] && [ -e "$HF_HOME/token" ] && found+=("$HF_HOME/token")
while IFS= read -r f; do found+=("$f"); done < <(find "$HOME" -maxdepth 3 -name '.env*' -type f -not -path "$ROOT/*" 2>/dev/null)
if [ ${#found[@]} -gt 0 ]; then
  echo "secret files on this machine: ${found[*]}" >&2
  echo "Run submissions on a new pod with no secrets, not here." >&2
  exit 1
fi

# The pod's own variables: code can read them in /proc/1/environ, so env -i does not hide them.
if [ -r /proc/1/environ ]; then
  # RUNPOD_API_KEY is pod-scoped (it can act only on this pod), and PUBLIC_KEY is the SSH key.
  # Other RUNPOD_ names describe the pod, but RunPod secrets are RUNPOD_SECRET_<name>.
  keys=$(tr '\0' '\n' </proc/1/environ | cut -d= -f1 | grep -E "(^|_)(KEY|TOKEN|PASSWORD|SECRET|CREDENTIALS?)(_|$)|$SECRET" |
    awk '!/^(PUBLIC_KEY|RUNPOD_API_KEY)$/ && !(/^RUNPOD_/ && !/(KEY|TOKEN|PASSWORD|SECRET)/)' || true)
  [ -n "$keys" ] && echo "run-isolated: warning: submitted code can read these variables of the pod: $(echo $keys)" >&2
fi

env_args=(PATH="$PATH" HOME="$HOME" LANG="${LANG:-C.UTF-8}" TERM="${TERM:-dumb}")
for name in HF_HOME UV_CACHE_DIR CUDA_VISIBLE_DEVICES "${allow[@]}"; do
  [ -n "${!name:-}" ] && env_args+=("$name=${!name}")
done
echo "run-isolated: openaudit $(git -C "$ROOT" rev-parse --short HEAD), variables: PATH HOME LANG TERM HF_HOME UV_CACHE_DIR CUDA_VISIBLE_DEVICES ${allow[*]}" >&2
exec env -i "${env_args[@]}" "$@"
