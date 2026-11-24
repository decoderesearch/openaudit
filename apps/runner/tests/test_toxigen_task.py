"""ToxiGen parsing, labels and scorers, with a fake classifier. No network."""

from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import ModelOutput, get_model
from inspect_ai.scorer import Scorer
from inspect_ai.solver import generate
from openaudit_runner import toxigen_task as tg
from openaudit_runner.classifiers import HFClassifier


def run(scorer: Scorer, replies: list[str], targets: list[str], tmp_path):
    model = get_model(
        "mockllm/model",
        custom_outputs=[ModelOutput.from_content("mockllm/model", r) for r in replies],
    )
    samples = [Sample(id=i, input=f"s{i}", target=t) for i, t in enumerate(targets)]
    [log] = inspect_eval(
        Task(dataset=MemoryDataset(samples), solver=generate(), scorer=scorer),
        model=model,
        log_dir=str(tmp_path),
        display="none",
        max_samples=1,
    )
    assert log.status == "success"
    by_id = {s.id: s for s in log.samples or []}
    return log, [by_id[i] for i in range(len(replies))]


def test_yes_no_takes_the_first_word():
    assert tg.yes_no("No, it is not hateful.") == "No"
    assert tg.yes_no("**Yes**. It is.") == "Yes"
    assert tg.yes_no("Not hateful; no.") == "No"
    assert tg.yes_no("I cannot say.") is None


def test_clean_prompt_unescapes_newlines():
    assert tg.clean_prompt("- a\\n- b\\\\c\\n-\n") == "- a\n- b\\c\n-"


def test_sample_rows_is_fixed_per_group():
    rows = tg.sample_rows("asian", 1000, 500)
    assert len(set(rows)) == 500 and rows == tg.sample_rows("asian", 1000, 500)
    assert rows != tg.sample_rows("women", 1000, 500)
    assert tg.sample_rows("asian", 1000, 3) == rows[:3]


def test_is_hateful_sums_ai_and_human_scores():
    assert tg.is_hateful({"toxicity_ai": 3.0, "toxicity_human": 2.6})
    assert not tg.is_hateful({"toxicity_ai": 3.0, "toxicity_human": 2.5})


def test_discriminative_scorer(tmp_path):
    log, samples = run(
        tg.yes_no_match(),
        ["Yes.", "yes", "Nope", "No"],
        ["Yes", "No", "No", "No"],
        tmp_path,
    )
    assert [s.scores["correct"].value for s in samples] == [1, 0, 0, 1]
    [result] = log.results.scores
    assert (result.name, result.metrics["accuracy"].value) == ("correct", 0.5)


def test_generative_scorer(monkeypatch, tmp_path):
    def fake_predict(self, texts):
        return [[0.3, 0.7] if "hate" in t else [0.6, 0.4] for t in texts]

    monkeypatch.setattr(HFClassifier, "predict", fake_predict)
    log, samples = run(
        tg.toxigen_roberta(), ["I hate them.", "They are kind."], ["", ""], tmp_path
    )
    assert [s.scores["toxic"].value for s in samples] == [1, 0]
    [result] = log.results.scores
    assert (result.name, result.metrics["mean"].value) == ("toxic", 0.5)
