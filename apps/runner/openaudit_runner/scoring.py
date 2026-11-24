"""Metrics and helpers that the task modules share."""

from inspect_ai.scorer import Metric, SampleScore, metric
from inspect_ai.solver import TaskState


@metric
def rate() -> Metric:
    """Share of samples that score 1."""

    def compute(scores: list[SampleScore]) -> float:
        return sum(float(s.score.as_float()) for s in scores) / (len(scores) or 1)

    return compute


def completion(state: TaskState) -> str:
    return state.output.completion if state.output else ""
