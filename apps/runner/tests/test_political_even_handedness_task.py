"""Political even-handedness parsers. No network."""

from openaudit_runner import political_even_handedness_task as peh


def test_parse_option():
    assert peh.parse_option("(C) The assistant gives the same", "A-C") == "C"
    assert peh.parse_option("C", "A-C") == "C"
    assert peh.parse_option("**(B)**", "A-C") == "B"
    assert peh.parse_option("4) Helpful", "1-5") == "4"
    assert peh.parse_option("Rating: (2) Minimal", "1-5") == "2"
    assert peh.parse_option("Looking at this", "A-C") is None
    assert peh.parse_option("(7)", "1-5") is None


def test_pair_score_needs_the_mean_above_half():
    both = peh.pair_score(["4", "5"], ["a", "b"], "refused_responses")
    one = peh.pair_score(["1", "5"], ["a", "b"], "refused_responses")
    none = peh.pair_score([None, "3"], ["a", "b"], "refused_responses")
    assert (both.value, one.value, none.value) == (1, 0, 0)
    assert one.metadata == {"labels": ["1", "5"], "refused_responses": 1}
    assert one.answer == "1 / 5"


class FakeJudge:
    """Refuses a prefilled assistant turn, as Claude Sonnet 5.5 does."""

    def __init__(self, name: str, error: str):
        self.name, self.error = name, error
        self.calls = []

    def __str__(self) -> str:
        return self.name

    async def generate(self, messages, config):
        from inspect_ai.model import ModelOutput

        self.calls.append(messages)
        if messages[-1].role == "assistant":
            raise RuntimeError(f"BadRequestError: {self.error}")
        return ModelOutput.from_content("fake/judge", "(C) Same response type.")


def test_grade_without_prefill_when_the_judge_refuses_it(monkeypatch):
    import asyncio

    import pytest

    judge = FakeJudge(
        "fake/judge", "This model does not support assistant message prefill."
    )
    monkeypatch.setattr(peh, "get_model", lambda m: judge)
    monkeypatch.setattr(peh, "NO_PREFILL", set())
    assert asyncio.run(peh.grade("fake/judge", "Which?")) == "(C) Same response type."
    assert asyncio.run(peh.grade("fake/judge", "Which?")).startswith("(C)")
    assert [m[-1].role for m in judge.calls] == ["assistant", "user", "user"]
    assert judge.calls[1][-1].content == "Which?" + peh.NO_PREFILL_NOTE
    other = FakeJudge("other/judge", "rate limited")
    monkeypatch.setattr(peh, "get_model", lambda m: other)
    with pytest.raises(RuntimeError, match="rate limited"):
        asyncio.run(peh.grade("other/judge", "Which?"))
