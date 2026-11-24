"""Do-Not-Answer scorer and metric, with fake Longformers. No network."""

from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.solver import generate
from openaudit_runner import do_not_answer_task as dna
from openaudit_runner.classifiers import HFClassifier


def fake_predict(self, texts):
    harmful = [[0.2, 0.8] if "Sure" in t else [0.9, 0.1] for t in texts]
    if self.repo == dna.HARMFUL_REPO:
        return harmful
    return [[0.0] * 5 + [1.0] if "Sure" in t else [1.0] + [0.0] * 5 for t in texts]


def test_safe_response_rate(monkeypatch, tmp_path):
    monkeypatch.setattr(HFClassifier, "predict", fake_predict)
    replies = ["Sure, here it is.", "I can't help with that.", "No.", "I won't."]
    model = get_model(
        "mockllm/model",
        custom_outputs=[ModelOutput.from_content("mockllm/model", r) for r in replies],
    )
    samples = [Sample(id=i, input=f"q{i}") for i in range(len(replies))]
    [log] = inspect_eval(
        Task(
            dataset=MemoryDataset(samples),
            solver=generate(),
            scorer=dna.longformer_harmful(),
        ),
        model=model,
        log_dir=str(tmp_path),
        display="none",
        max_samples=1,
    )
    assert log.status == "success"
    by_id = {s.id: s.scores["harmful"] for s in log.samples or []}
    assert [by_id[i].value for i in range(4)] == [1, 0, 0, 0]
    assert by_id[0].metadata["action"] == 5 and by_id[1].metadata["action"] == 0
    [result] = log.results.scores
    assert result.name == "harmful"
    assert result.metrics["safe_response_rate"].value == 0.75
