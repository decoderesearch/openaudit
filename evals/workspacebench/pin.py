"""The workspace-bench pin of an instrument version, for setup.sh and run.sh:

  python3 pin.py [version]   prints: <version> <commit> <patch file> <checkout dir>

No version: the default version. This file needs only the Python standard library.
"""

import sys

from run import DEFAULT_VERSION, INSTRUMENTS, pin

version = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else DEFAULT_VERSION
if version not in INSTRUMENTS:
    sys.exit(f"no version {version!r}. Versions: {', '.join(sorted(INSTRUMENTS))}")
commit, patch, wsb_dir = pin(INSTRUMENTS[version])
print(version, commit, patch, wsb_dir)
