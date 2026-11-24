"""Offline tests of the scoring, the labels and results.json: no GPU, no download."""

import importlib.util
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))


def load(name: str):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


scoring = load("scoring")
run = load("run")


def row(label: int, flagged: bool) -> dict:
    return {"label": label, "flagged": flagged}


def test_balanced_accuracy():
    m = scoring.metrics([row(1, True), row(1, False), row(0, False), row(0, False)])
    assert m == {"balanced_accuracy": 0.75, "tpr": 0.5, "tnr": 1.0}


def test_flag_all_or_none_is_chance():
    rows = [row(1, False), row(0, False)]
    assert scoring.metrics(rows)["balanced_accuracy"] == 0.5
    rows = [row(1, True), row(0, True)]
    assert scoring.metrics(rows)["balanced_accuracy"] == 0.5


def test_one_label_fails():
    with pytest.raises(ValueError):
        scoring.metrics([row(1, True)])


def test_the_example_flags_nothing():
    detector = load("examples/flag_none").load_detector("any/model")
    assert detector.score("text") <= detector.threshold


def test_a_new_run_of_a_model_replaces_the_old_one(tmp_path):
    run.write_results(tmp_path, "a/model", {"tier": "smoke"})
    run.write_results(tmp_path, "b/model", {"tier": "full"})
    run.write_results(tmp_path, "a/model", {"tier": "full"})
    results = json.loads((tmp_path / "results.json").read_text())
    assert results["schema"] == run.RESULTS_SCHEMA
    assert results["runs"] == {"a/model": {"tier": "full"}, "b/model": {"tier": "full"}}


def test_a_false_statement_has_label_1():
    assert run.to_item({"statement": "Paris is a city.", "label": True}) == {
        "text": "Paris is a city.",
        "label": 0,
    }
    assert run.to_item({"statement": "Paris is a country.", "label": False})["label"] == 1
