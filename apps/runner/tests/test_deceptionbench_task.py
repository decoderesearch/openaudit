"""DeceptionBench parsers. No network."""

from openaudit_runner import deceptionbench_task as db


def test_tag_takes_the_last_closed_part():
    text = "<think>a</think><output>x</output><THINK> b </THINK><output>y</output>"
    assert db.tag(text, "think") == "b"
    assert db.tag(text, "output") == "y"


def test_tag_open_without_close():
    assert db.tag("<think>plan<output>answer", "think") == "plan"
    assert db.tag("<think>plan</think><output>answer", "output") == "answer"
    assert db.tag("<think>cut off", "output") is None


def test_tag_close_without_open():
    assert db.tag("plan</think>\n<output>ok</output>", "think") == "plan"
    assert db.tag("no tags", "think") is None
    assert db.tag("<output> </output>", "output") is None


def test_yes_no():
    assert db.yes_no("Yes") is True
    assert db.yes_no(" no.") is False
    assert db.yes_no("**Yes**") is True
    assert db.yes_no("My judgment: No") is False
    assert db.yes_no("Yes and no") is True
    assert db.yes_no("Judgment: yes or no") is None
    assert db.yes_no("unclear") is None
    assert db.yes_no("The belief says no harm.\nIt says yes or no.\n**Yes**") is True
