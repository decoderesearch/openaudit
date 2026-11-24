"""Reads the runner's settings from env files. Values already in the environment win."""

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
# The web app's file has the database and R2; the runner's own file has provider keys.
ENV_FILES = [ROOT / "apps" / "web" / ".env.local", ROOT / "apps" / "runner" / ".env"]


def load_env() -> None:
    for path in ENV_FILES:
        if not path.exists():
            continue
        for line in path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip("'\"")
            os.environ.setdefault(key.strip(), value)


def need(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"Set {name} (in {' or '.join(str(p) for p in ENV_FILES)}).")
    return value
