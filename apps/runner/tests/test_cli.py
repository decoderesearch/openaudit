import pytest

from openaudit_runner.cli import refuse_dated


class _Conn:
    def __init__(self, row):
        self.row = row

    def execute(self, sql, args):
        return self

    def fetchone(self):
        return self.row


@pytest.mark.parametrize("status", ["legacy", "saturated"])
def test_refuse_dated_stops_a_new_run_of_a_dated_eval(status):
    with pytest.raises(SystemExit, match=f"bbq is {status}"):
        refuse_dated(_Conn({"slug": "bbq", "status": status}), "e1")


def test_refuse_dated_lets_an_active_eval_run():
    refuse_dated(_Conn({"slug": "mask", "status": "active"}), "e1")
