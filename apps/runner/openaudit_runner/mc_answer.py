"""Inspect's multiple-choice parser, with one fix. Its template asks for 'ANSWER: $LETTER', and some
models keep the `$` ("ANSWER: $D"). Inspect reads "$D$" but not "$D", so the reply fails. The
import puts `parse_answers` in place of Inspect's: the `multiple_choice` solver reads it then."""

import re
from types import SimpleNamespace
from typing import Any

from inspect_ai.solver import _multiple_choice as mc

LONE_DOLLAR = re.compile(r"(?i)(ANSWER\s*:\s*)\$\s*(?=[A-Za-z\d])")

_parse_answers = mc.parse_answers


def parse_answers(state: Any, multiple_correct: bool) -> set[str]:
    """Inspect's answers. With none, Inspect's answers after a lone `$` goes."""
    answers = _parse_answers(state, multiple_correct)
    completion = state.output.completion or ""
    fixed = LONE_DOLLAR.sub(r"\1", completion)
    if answers or fixed == completion:
        return answers
    return _parse_answers(
        SimpleNamespace(output=SimpleNamespace(completion=fixed), choices=state.choices),
        multiple_correct,
    )


def answers_in(completion: str, choices: int, multiple_correct: bool = False) -> set[str]:
    """The letters that `parse_answers` reads in a stored reply to a question with `choices` options."""
    state = SimpleNamespace(
        output=SimpleNamespace(completion=completion), choices=[None] * choices
    )
    return parse_answers(state, multiple_correct)


mc.parse_answers = parse_answers
