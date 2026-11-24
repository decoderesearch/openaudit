"""Offline tests of the recipe: its TRAIN_DATA is the one in submission.json, and it has the
function that the harness calls. No GPU, no download."""

import importlib.util
import json
from pathlib import Path

import pytest

pytest.importorskip("torch")

HERE = Path(__file__).resolve().parents[2]


def load_recipe():
    spec = importlib.util.spec_from_file_location("recipe", HERE / "code" / "recipe.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_train_data_is_the_submitted_one():
    submission = json.loads((HERE / "submission.json").read_text())
    assert load_recipe().TRAIN_DATA == submission["recipe"]["trainData"]


def test_the_recipe_fits_a_detector():
    assert callable(load_recipe().fit_detector)
