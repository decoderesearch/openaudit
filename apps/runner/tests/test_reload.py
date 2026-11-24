"""A long-running loop sees when the runner's code changes."""

import os

from openaudit_runner import reload


def test_code_watch_sees_a_newer_file(tmp_path):
    (tmp_path / "a.py").write_text("x = 1\n")
    watch = reload.CodeWatch(tmp_path)
    assert not watch.changed()
    b = tmp_path / "sub" / "b.py"
    b.parent.mkdir()
    b.write_text("y = 2\n")
    os.utime(b, (watch.start + 10, watch.start + 10))
    assert watch.changed()


def test_restart_runs_the_same_command(tmp_path, monkeypatch):
    (tmp_path / "a.py").write_text("x = 1\n")
    watch = reload.CodeWatch(tmp_path)
    calls = []
    monkeypatch.setattr(reload.os, "execv", lambda path, argv: calls.append((path, argv)))
    reload.restart_if_changed(watch, "Test")
    assert calls == []
    os.utime(tmp_path / "a.py", (watch.start + 10, watch.start + 10))
    reload.restart_if_changed(watch, "Test")
    assert calls == [(reload.sys.executable, reload.sys.orig_argv)]
