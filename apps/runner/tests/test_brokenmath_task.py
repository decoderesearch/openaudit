"""BrokenMath parsers and scorer, on Inspect's mock model. No network."""

from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.solver import generate
from openaudit_runner import brokenmath_task as bm


def test_effort_is_high_unless_set(monkeypatch):
    monkeypatch.setattr(
        bm, "hf_dataset", lambda *a, **k: MemoryDataset([Sample(input="x")])
    )
    assert bm.brokenmath.__wrapped__().config.reasoning_effort == "high"
    assert (
        bm.brokenmath.__wrapped__(reasoning_effort=None).config.reasoning_effort is None
    )


def test_extract_judgement_takes_the_last_box():
    assert bm.extract_judgement(r"Not \boxed{correct}. So \boxed{detected}") == (
        "detected"
    )
    assert bm.extract_judgement(r"\boxed{\text{ Corrected }}") == "corrected"
    assert bm.extract_judgement(r"\boxed{\textbf{incorrect}}") == "incorrect"


def test_extract_judgement_failures():
    assert bm.extract_judgement("no box") is None
    assert bm.extract_judgement(r"\boxed{correct") is None
    assert bm.extract_judgement(r"\boxed{ideal}") == "incorrect"


def test_final_solution_drops_reasoning():
    assert bm.final_solution("plan</think>a</think> proof ") == "proof"
    assert bm.final_solution(" proof ") == "proof"


def test_majority_tie_goes_to_first_label():
    assert bm.majority(["detected", "incorrect", "incorrect"]) == "incorrect"
    assert bm.majority(["corrected", "detected", "incorrect"]) == "corrected"


def test_scorer_votes_and_skips_short_replies(tmp_path):
    def judge(*texts):
        return get_model(
            "mockllm/judge",
            custom_outputs=[
                ModelOutput.from_content("mockllm/judge", t) for t in texts
            ],
        )

    target = get_model(
        "mockllm/model",
        custom_outputs=[
            ModelOutput.from_content("mockllm/model", "A long proof of the claim."),
            ModelOutput.from_content("mockllm/model", "short"),
        ],
    )
    meta = {
        "problem": "p",
        "original_problem": "o",
        "solution": "s",
        "subset": "proof",
    }
    samples = [Sample(id=f"s{i}", input="x", metadata=meta) for i in range(2)]
    scorer = bm.brokenmath_judge(
        judge(r"\boxed{incorrect}", "no box", r"\boxed{detected}")
    )
    [log] = inspect_eval(
        Task(dataset=MemoryDataset(samples), solver=generate(), scorer=scorer),
        model=target,
        log_dir=str(tmp_path),
        display="none",
        max_samples=1,
    )
    assert log.status == "success"
    by_id = {s.id: s for s in log.samples or []}
    score = by_id["s0"].scores["sycophantic"]
    assert score.value == 1
    assert score.metadata["votes"] == ["incorrect", "incorrect", "detected"]
    assert score.metadata["parse_failures"] == 1
    assert "sycophantic" not in (by_id["s1"].scores or {})
    [result] = log.results.scores
    assert result.scored_samples == 1
    assert result.metrics["rate"].value == 1
