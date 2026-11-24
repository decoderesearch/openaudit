# syntax=docker/dockerfile:1.7
# The runner on CPU, for Cloudflare Containers. Build from the repo root:
#   docker build -f apps/runner/Dockerfile -t openaudit-runner .
# The image has no datasets or weights. The runner gets them from R2 at run time.

FROM python:3.13-slim AS deps
# uv needs git for the locked git packages (LABBench2).
RUN apt-get update && apt-get install -y --no-install-recommends git \
 && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /bin/uv
ENV UV_PYTHON_DOWNLOADS=never UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy
WORKDIR /src
# Only the lock and the pyproject files, so a code change keeps this layer (2.3 GB) cached.
COPY pyproject.toml uv.lock ./
COPY spec/generated/python/pyproject.toml spec/generated/python/pyproject.toml
COPY apps/runner/pyproject.toml apps/runner/pyproject.toml

# The lock gives the CUDA torch. Install the CPU build of the same version, then the other
# locked packages without the CUDA packages.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /opt/venv --python /usr/local/bin/python3.13 \
 && uv export --frozen --no-dev --no-hashes --no-emit-workspace --package openaudit-runner \
      --extra classifiers -o /tmp/all.txt \
 && grep -Ev '^(nvidia-|triton==|torch==|cuda-)' /tmp/all.txt > /tmp/req.txt \
 && TORCH=$(grep -E '^torch==' /tmp/all.txt | cut -d' ' -f1) \
 && VIRTUAL_ENV=/opt/venv uv pip install --no-deps --index-url https://download.pytorch.org/whl/cpu "$TORCH" \
 && VIRTUAL_ENV=/opt/venv uv pip install --no-deps -r /tmp/req.txt

FROM python:3.13-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini \
 && rm -rf /var/lib/apt/lists/*
COPY --from=deps /opt/venv /opt/venv
ENV PATH=/opt/venv/bin:$PATH PYTHONUNBUFFERED=1 HF_HUB_DISABLE_TELEMETRY=1
RUN useradd --create-home runner

# The workspace code goes in its own small layer, so a deploy of a code change pushes only it.
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=spec/generated/python,target=/src/spec \
    --mount=type=bind,source=apps/runner,target=/src/runner \
    --mount=from=ghcr.io/astral-sh/uv:0.11.7,source=/uv,target=/bin/uv \
    UV_PYTHON_DOWNLOADS=never UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy VIRTUAL_ENV=/opt/venv \
    uv pip install --no-deps /src/spec /src/runner
USER runner
WORKDIR /home/runner

# tini is PID 1 and sends SIGTERM to the whole process group, so the runner stops when the
# platform stops the container. With no arguments, the container runs the shards of $RUN_ID.
ENTRYPOINT ["tini", "-g", "--", "sh", "-c", "if [ $# -gt 0 ]; then exec openaudit-runner \"$@\"; fi; exec openaudit-runner work --run \"$RUN_ID\" --exit-when-idle", "sh"]
