"""The multiple-choice parser reads a lone `$` before the letter, as the template's `$LETTER` has."""

from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.scorer import choice
from inspect_ai.solver import _multiple_choice as mc
from inspect_ai.solver import multiple_choice

from openaudit_runner import mc_answer


def test_reads_a_lone_dollar():
    assert mc_answer.answers_in("ANSWER: $D", 4) == {"D"}
    assert mc_answer.answers_in("Some steps.\nANSWER: $ b.", 4) == {"B"}
    assert mc_answer.answers_in("ANSWER: $A, C", 4, multiple_correct=True) == {"A", "C"}


def test_keeps_what_inspect_reads():
    assert mc_answer.answers_in("ANSWER: D", 4) == {"D"}
    assert mc_answer.answers_in("ANSWER: $D$", 4) == {"D"}
    assert mc_answer.answers_in("ANSWER: $E", 4) == set()
    assert mc_answer.answers_in("It costs $5.", 4) == set()


def test_the_solver_uses_it():
    assert mc.parse_answers is mc_answer.parse_answers
    task = Task(
        dataset=MemoryDataset(
            [Sample(input="Which?", choices=["w", "x", "y", "z"], target="D")]
        ),
        solver=multiple_choice(),
        scorer=choice(),
    )
    model = get_model(
        "mockllm/model",
        custom_outputs=[ModelOutput.from_content("mockllm/model", "ANSWER: $D")],
    )
    [log] = inspect_eval(task, model=model, display="none")
    score = log.samples[0].scores["choice"]
    assert (score.value, score.answer) == ("C", "D")
