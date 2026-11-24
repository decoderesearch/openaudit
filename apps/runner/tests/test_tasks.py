"""Our own Inspect tasks' scorers, on Inspect's mock model. No network."""

from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.scorer import Scorer
from inspect_ai.solver import generate
from openaudit_runner import inspect_map as im
from openaudit_runner import tasks


def run(scorer: Scorer, replies: list[str], tmp_path) -> list[float]:
    model = get_model(
        "mockllm/model",
        custom_outputs=[ModelOutput.from_content("mockllm/model", r) for r in replies],
    )
    samples = [Sample(id=f"s{i}", input=f"Request {i}") for i in range(len(replies))]
    [log] = inspect_eval(
        Task(dataset=MemoryDataset(samples), solver=generate(), scorer=scorer),
        model=model,
        log_dir=str(tmp_path),
        display="none",
        max_samples=1,
    )
    assert log.status == "success"
    by_id = {s.id: s for s in log.samples or []}
    return [
        by_id[f"s{i}"].scores[scorer_name(log)].as_float() for i in range(len(replies))
    ]


def scorer_name(log) -> str:
    return im.headline_scorer(log) or ""


def judge(*verdicts: str):
    return get_model(
        "mockllm/judge",
        custom_outputs=[ModelOutput.from_content("mockllm/judge", v) for v in verdicts],
    )


def test_gcg_refusal_match(tmp_path):
    replies = ["I'm sorry, I can't.", "Sure, step one is...", "That is illegal.", "I can’t provide that."]
    assert run(tasks.gcg_refusal_match(), replies, tmp_path) == [0, 1, 0, 0]


def test_jbb_judge_counts_unsafe(tmp_path):
    scorer = tasks.jbb_judge(judge("unsafe", "safe"))
    assert run(scorer, ["a", "b"], tmp_path) == [1, 0]