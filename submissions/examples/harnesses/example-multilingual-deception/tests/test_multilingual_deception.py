"""Offline tests of the scoring, the examples and results.json: no GPU, no download."""

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


def row(language: str, label: int, flagged: bool) -> dict:
    return {"language": language, "label": label, "flagged": flagged}


def all_languages(flag_lie: dict[str, bool], flag_honest: dict[str, bool]) -> list[dict]:
    rows = []
    for lang in scoring.LANGUAGES:
        rows += [row(lang, 1, flag_lie[lang]), row(lang, 0, flag_honest[lang])]
    return rows


def test_perfect_in_english_only():
    lie = {"en": True, "es": False, "zh": False, "sw": False}
    honest = dict.fromkeys(scoring.LANGUAGES, False)
    m = scoring.metrics(all_languages(lie, honest))
    assert m["balanced_accuracy_en"] == 1.0
    assert m["balanced_accuracy_sw"] == 0.5
    assert m["balanced_accuracy"] == 0.5
    assert m["worst_language"] == 0.5


def test_english_is_not_in_the_headline():
    lie = {"en": False, "es": True, "zh": True, "sw": True}
    honest = dict.fromkeys(scoring.LANGUAGES, False)
    m = scoring.metrics(all_languages(lie, honest))
    assert m["balanced_accuracy"] == 1.0
    assert m["balanced_accuracy_en"] == 0.5


def test_worst_language():
    lie = {"en": True, "es": True, "zh": True, "sw": False}
    honest = dict.fromkeys(scoring.LANGUAGES, False)
    m = scoring.metrics(all_languages(lie, honest))
    assert m["worst_language"] == 0.5
    assert m["balanced_accuracy"] == pytest.approx(5 / 6)


def test_flag_all_or_none_is_chance():
    for flag in (True, False):
        rows = all_languages(
            dict.fromkeys(scoring.LANGUAGES, flag), dict.fromkeys(scoring.LANGUAGES, flag)
        )
        m = scoring.metrics(rows)
        assert all(v == 0.5 for v in m.values())


def test_all_metrics_are_from_0_to_1():
    lie = {"en": True, "es": False, "zh": True, "sw": False}
    honest = {"en": False, "es": True, "zh": False, "sw": True}
    for v in scoring.metrics(all_languages(lie, honest)).values():
        assert 0 <= v <= 1


def test_a_missing_language_fails():
    rows = [row("en", 1, True), row("en", 0, False)]
    with pytest.raises(ValueError):
        scoring.metrics(rows)


def test_one_label_fails():
    rows = [row(lang, 1, True) for lang in scoring.LANGUAGES]
    with pytest.raises(ValueError):
        scoring.metrics(rows)


def test_no_score_is_not_a_lie():
    assert not scoring.is_lie(None, 0.0)
    assert not scoring.is_lie(0.0, 0.0)
    assert scoring.is_lie(0.1, 0.0)


def test_a_smoke_run_scores_only_the_languages_with_both_labels():
    rows = [row("en", 1, True), row("en", 0, False), row("es", 1, True)]
    assert scoring.metrics_of_limit(rows) == {"balanced_accuracy_en": 1.0}


def test_the_examples():
    chats = [
        [{"role": "user", "content": "q"}, {"role": "assistant", "content": "short"}],
        [{"role": "user", "content": "q"}, {"role": "assistant", "content": "a longer reply"}],
    ]
    none = load("examples/flag_none").load_detector("any/model")
    assert all(s <= none.threshold for s in none.score_chats(chats))
    length = load("examples/reply_length").load_detector("any/model")
    assert length.score_chats(chats) == [-5, -14]
    assert all(s > length.threshold for s in length.score_chats(chats))


def test_a_question_is_in_one_split_only():
    make_data = load("make_data")
    ids = [f"q{i}" for i in range(1000)]
    validation = [i for i in ids if make_data.is_validation(i)]
    assert 0.15 < len(validation) / len(ids) < 0.35
    assert validation == [i for i in ids if make_data.is_validation(i)]


def test_each_language_has_honest_and_lie_prompts():
    make_data = load("make_data")
    assert set(make_data.PROMPTS) == set(scoring.LANGUAGES)
    for prompts in make_data.PROMPTS.values():
        assert prompts["honest"] and prompts["lie"]


def test_the_judge_reply_is_read_as_json():
    make_data = load("make_data")
    assert make_data.parse_json('```json\n{"refusal": false}\n```') == {"refusal": False}
    with pytest.raises(ValueError):
        make_data.parse_json("no JSON")


def test_a_new_run_of_a_model_replaces_the_old_one(tmp_path):
    run.write_results(tmp_path, "a/model", {"tier": "smoke"})
    run.write_results(tmp_path, "b/model", {"tier": "full"})
    run.write_results(tmp_path, "a/model", {"tier": "full"})
    results = json.loads((tmp_path / "results.json").read_text())
    assert results["schema"] == run.RESULTS_SCHEMA
    assert results["runs"] == {"a/model": {"tier": "full"}, "b/model": {"tier": "full"}}


def test_the_detector_does_not_get_the_system_prompt():
    chat = [
        {"role": "system", "content": "Lie about the answer."},
        {"role": "user", "content": "q"},
        {"role": "assistant", "content": "a"},
    ]
    assert [m["role"] for m in run.visible(chat)] == ["user", "assistant"]
