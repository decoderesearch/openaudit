import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# The scripts import torch and SAEBench only in their functions.
common = load("common", HERE / "common.py")
saebench = load("sae_saebench", HERE / "saebench.py")
synth = load("sae_synth", HERE / "synth.py")
rules = json.loads((HERE / "submission" / "rules.json").read_text())


def seed_versions(slug):
    return [
        v["version"]
        for v in json.loads(
            (REPO / "data" / "seed" / "evals" / f"{slug}.json").read_text()
        )["versions"]
    ]


def test_the_evals_are_the_rules_evals_and_seed_versions():
    evals = {slug: version for slug, version, _, _ in saebench.EVALS.values()}
    evals[synth.EVAL[0]] = synth.EVAL[1]
    assert evals == rules["evals"]
    for slug, version in evals.items():
        assert version in seed_versions(slug), slug


def test_the_subjects_are_the_rules_models():
    assert [*saebench.SUBJECTS, synth.SUBJECT] == rules["models"]
    assert sorted(rules["required"]) == sorted(rules["models"])


def test_each_required_eval_has_published_settings():
    configs = json.loads((HERE / "saebench_configs.json").read_text())
    by_slug = {slug: name for name, (slug, *_) in saebench.EVALS.items()}
    for model, subject in saebench.SUBJECTS.items():
        for slug in rules["required"][model]:
            cfg = configs[subject["name"]][by_slug[slug]]
            assert cfg.get("model_name") in (subject["name"], model), slug


def test_pick():
    assert saebench.pick({"a": {"b": 0.5}}, "a.b") == 0.5
    assert saebench.pick({"a": {}}, "a.b") is None
    assert saebench.pick({"a": 1}, "a.b") is None


def run(sha, tier, evals):
    return {"tier": tier, "sae": {"sha256": sha}, "evals": evals, "seconds": 1}


def test_a_run_of_the_same_sae_keeps_the_old_evals(tmp_path):
    common.write_run(tmp_path, "m/x", run("a", "full", {"core": 1}))
    common.write_run(tmp_path, "m/x", run("a", "full", {"tpp": 2}))
    r = json.loads((tmp_path / "results.json").read_text())
    assert r["schema"] == common.RESULTS_SCHEMA
    assert r["runs"]["m/x"]["evals"] == {"core": 1, "tpp": 2}
    assert r["runs"]["m/x"]["seconds"] == 2
    common.write_run(tmp_path, "m/x", run("b", "full", {"scr": 3}))
    common.write_run(tmp_path, "m/y", run("b", "smoke", {"core": 4}))
    common.write_run(tmp_path, "m/y", run("b", "full", {"tpp": 5}))
    r = json.loads((tmp_path / "results.json").read_text())
    assert r["runs"]["m/x"]["evals"] == {"scr": 3}
    assert r["runs"]["m/y"]["evals"] == {"tpp": 5}


def test_leaderboard_rank(monkeypatch, capsys):
    monkeypatch.setattr(
        common,
        "published",
        lambda *_, baselines=False: (
            [(0.5, "ICA Lens"), (0.7, "ICA Lens")]
            if baselines
            else [(0.1, "a"), (0.3, "b"), (0.2, "c")]
        ),
    )
    common.leaderboard("m/x", "e", "k", 0.25)
    out = capsys.readouterr().out
    assert "number 2 of 4" in out
    assert "0.6000  ICA Lens (mean of 2)" in out
    common.leaderboard("m/x", "e", "k", 0.25, lower=True)
    out = capsys.readouterr().out
    assert "number 3 of 4" in out
    assert out.index("0.1000") < out.index("0.2000")
