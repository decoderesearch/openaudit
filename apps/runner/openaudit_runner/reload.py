"""A long-running loop starts again when the runner's code changes, so it never runs old code.
Call `restart_if_changed` only when the loop holds no lease."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def code_mtime(root: Path = ROOT) -> float:
    return max((p.stat().st_mtime for p in root.rglob("*.py")), default=0.0)


class CodeWatch:
    def __init__(self, root: Path = ROOT) -> None:
        self.root = root
        self.start = code_mtime(root)

    def changed(self) -> bool:
        return code_mtime(self.root) > self.start


def restart(name: str, why: str) -> None:
    """Runs the same command again in this process (same pid)."""
    print(f"{name}: {why}; starting again.", flush=True)
    os.execv(sys.executable, sys.orig_argv)


def restart_if_changed(watch: CodeWatch, name: str) -> None:
    """Starts again when the code changed."""
    if watch.changed():
        restart(name, "the runner code changed")
