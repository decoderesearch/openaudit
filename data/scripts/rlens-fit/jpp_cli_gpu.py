"""Run jpp_lens scripts/jpp_cli.py from the harness root (the current folder)."""

import runpy
import sys

if sys.argv[1:2] == ["fit-shard"]:
    sys.modules["fla"] = None  # LRP surgery needs the torch GatedDeltaNet path
sys.argv = ["scripts/jpp_cli.py", *sys.argv[1:]]
runpy.run_path("scripts/jpp_cli.py", run_name="__main__")
