import importlib.util
import json
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


scoring = load("wsb_scoring", HERE / "scoring.py")
run = load("wsb_run", HERE / "run.py")


def family_file(tmp_path, family, value, complete=True, metric="pass_rate", spend=0.5):
    path = tmp_path / f"{family}.json"
    path.write_text(
        json.dumps(
            {
                "family": family,
                "numbers": {"metric": metric, "value": value, "ci95": [0, 1]},
                "n_items": 10,
                "complete": complete,
                "config": {"judge_model": "claude-opus-5-5", "prompt_version": "v1"},
                "counts": {"spend_usd": spend},
            }
        )
    )
    return path


def test_family_row(tmp_path):
    row = scoring.family_row(family_file(tmp_path, "poetry", 0.5))
    assert row == {
        "family": "poetry",
        "metric": "pass_rate",
        "value": 0.5,
        "ci95": [0, 1],
        "nItems": 10,
        "complete": True,
        "reads": "full",
        "judgeModel": "claude-opus-5-5",
        "promptVersion": "v1",
        "spendUsd": 0.5,
    }


def test_macro_takes_complete_macro_families_and_rounds_halves_up(tmp_path):
    rows = [
        scoring.family_row(family_file(tmp_path, "a", 0.1)),
        scoring.family_row(family_file(tmp_path, "b", 0.2)),
        scoring.family_row(family_file(tmp_path, "c", 0.9, complete=False)),
        scoring.family_row(family_file(tmp_path, "d", 0.9)),
        scoring.family_row(family_file(tmp_path, "e", 0.9, metric="auroc")),
        scoring.family_row(family_file(tmp_path, "f", -0.1)),
    ]
    m = scoring.macro(rows, {"a", "b", "c", "e", "f"})
    assert m == {"macro_score": 0.067, "macro_families": 3}
    assert scoring.metrics(rows, {"a", "b", "f"})["f"] == -0.1
    assert scoring._round(0.0625) == 0.063
    assert scoring._round(-0.0625) == -0.063


def test_no_macro_family_gives_no_macro(tmp_path):
    rows = [scoring.family_row(family_file(tmp_path, "a", 0.5, complete=False))]
    assert scoring.macro(rows, {"a"}) == {"macro_score": None, "macro_families": 0}
    assert scoring.metrics(rows, {"a"}) == {"macro_families": 0, "a": 0.5}


PUBLISHED = run.INSTRUMENTS["2026-11"]
FAST = run.INSTRUMENTS["6be6304-fast-safety"]


def test_default_version_is_our_fast_safety_setting():
    assert run.DEFAULT_VERSION == "6be6304-fast-safety"
    assert [v for v, d in run.INSTRUMENTS.items() if d.get("default")] == [run.DEFAULT_VERSION]
    assert not PUBLISHED.get("draft")


def test_shard_splits_items():
    assert run.parse_shard(None) is None
    assert run.parse_shard("1/4") == (1, 4)
    for bad in ("4/4", "x/2", "1"):
        with pytest.raises(SystemExit, match="--shard needs i/n"):
            run.parse_shard(bad)


def test_j_file_reads_the_plan_layers_that_it_has():
    from types import SimpleNamespace

    lens = run.LinearLens.__new__(run.LinearLens)
    lens.J = {k: None for k in range(63)}
    specs = [SimpleNamespace(layers=[20, 40, 63]), SimpleNamespace(layers=[20, 60])]
    assert run.lens_layers(lens, specs) == [20, 40, 60]
    assert run.lens_layers(object(), specs) is None


def test_merge_takes_each_item_once(tmp_path):
    merge = load("wsb_merge", HERE / "merge.py")
    shards = []
    for i, ids in enumerate((["a", "c"], ["b", "a"])):
        s = tmp_path / f"s{i}"
        (s / "readouts").mkdir(parents=True)
        (s / "version.txt").write_text("v\n")
        rows = [json.dumps({"id": x, "layer": layer}) for x in ids for layer in (1, 2)]
        (s / "readouts" / "poetry.jsonl").write_text("\n".join(rows) + "\n")
        (s / "readouts" / "poetry.jsonl.meta.json").write_text('{"fast": "f"}')
        shards.append(s)
    assert merge.merge(tmp_path / "all", shards) == {"poetry": 3}
    lines = (tmp_path / "all" / "readouts" / "poetry.jsonl").read_text().splitlines()
    assert len(lines) == 6 and (tmp_path / "all" / "version.txt").read_text() == "v\n"
    (shards[1] / "readouts" / "poetry.jsonl.meta.json").write_text('{"fast": "g"}')
    with pytest.raises(SystemExit, match="sidecars are missing or differ"):
        merge.merge(tmp_path / "all2", shards)


def test_our_lenses_are_pinned():
    lenses = json.loads((HERE / "lenses.json").read_text())
    assert set(lenses) == {"jlens", "jpp", "olens"}
    for key in ("jlens", "jpp"):
        assert len(lenses[key]["revision"]) == 40 and lenses[key]["readout"] in run.READOUTS
    assert (HERE / lenses["olens"]["reader"]).exists()


def test_each_version_pins_its_own_commit_and_patch():
    for version, inst in run.INSTRUMENTS.items():
        commit, patch, wsb_dir = run.pin(inst)
        assert len(commit) == 40 and int(commit, 16) >= 0, version
        assert patch.exists() and patch.name == f"{commit[:7]}.patch", version
        assert wsb_dir.name == commit[:7]
    assert run.pin(PUBLISHED)[0].startswith("2617613")  # the commit of our published runs
    assert FAST["version"].startswith(run.pin(FAST)[0][:7])


def test_macro_metrics_take_workspacebench_macro(tmp_path):
    rows = [
        scoring.family_row(family_file(tmp_path, "a", 0.1)),
        scoring.family_row(family_file(tmp_path, "b", 0.2)),
    ]
    m = scoring.macro_metrics(rows, {"value": 0.0625, "families": ["a", "b"], "excluded": []})
    assert m == {"macro_score": 0.063, "macro_families": 2, "a": 0.1, "b": 0.2}
    m = scoring.macro_metrics(rows, {"value": None, "families": [], "excluded": []})
    assert m == {"macro_families": 0, "a": 0.1, "b": 0.2}


def test_instrument_for_falls_back_to_lite_then_digest():
    inst = PUBLISHED
    cap = inst["maxPromptTokens"]
    direct = inst["opts"]
    assert run.instrument_for(inst, "x", {"full": cap, "lite": 1}) == {
        "reads": "full",
        "opts": direct,
    }
    assert run.instrument_for(inst, "x", {"full": cap + 1, "lite": cap}) == {
        "reads": "lite",
        "opts": direct,
    }
    assert run.instrument_for(inst, "x", {"full": cap + 1, "lite": cap + 1}) == {
        "reads": "lite",
        "opts": inst["fallbackOpts"],
    }


def test_fast_version_keeps_default_summarizer_where_luna_cannot():
    luna = "summ_model=openai/gpt-6-luna"
    assert run.family_opts(FAST, "poetry") == luna
    assert run.family_opts(FAST, "hinted_cutoff") == luna
    # Luna drops the introspection concept; in a regex family the summarizer is the scorer
    for fam in ("introspection", "model_specific_directed_modulation", "multilingual_typo"):
        assert run.family_opts(FAST, fam) == "aggregate=summary"  # the default summarizer
    assert set(FAST["familyOpts"]) <= set(FAST["families"])
    assert run.openrouter_models(FAST) == {"openai/gpt-6-luna"}
    assert run.openrouter_models(PUBLISHED) == set()


def test_version_stamp(tmp_path):
    run.check_version_stamp(tmp_path, "6be6304-fast-safety")
    run.check_version_stamp(tmp_path, "6be6304-fast-safety")
    with pytest.raises(SystemExit, match="use another --out"):
        run.check_version_stamp(tmp_path, "2026-11")
    old = tmp_path / "old"
    old.mkdir()
    (old / "results.json").write_text(
        json.dumps({"runs": {"m": {"instrument": {"version": "2026-11"}}}})
    )
    with pytest.raises(SystemExit, match="has a run of version 2026-11"):
        run.check_version_stamp(old, "6be6304-fast-safety")


@pytest.fixture
def no_keys(monkeypatch):
    for name in (
        "ANTHROPIC_API_KEY",
        "OPENROUTER_API_KEY",
        "WSB_BATCH",
        "WSB_CLAUDE_VIA_OPENROUTER",
        "WSB_JUDGE_EFFORT",
    ):
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def test_judge_env_routes(no_keys):
    no_keys.setenv("ANTHROPIC_API_KEY", "x")
    env = run.judge_env(PUBLISHED, None, batch=True)
    assert env["WSB_BATCH"] == "1" and run.judge_route(env) == "anthropic-batch"
    assert env["WSB_CACHE_USER"] == "1"
    env = run.judge_env(PUBLISHED, "medium", batch=False)
    assert "WSB_BATCH" not in env and env["WSB_JUDGE_EFFORT"] == "medium"
    assert run.judge_route(env) == "anthropic"
    with pytest.raises(SystemExit, match="needs OPENROUTER_API_KEY for openai/gpt-6-luna"):
        run.judge_env(FAST, None, batch=True)

    no_keys.setenv("OPENROUTER_API_KEY", "x")
    env = run.judge_env(FAST, None, batch=True)
    assert env["WSB_BATCH"] == "1" and run.judge_route(env) == "anthropic-batch"
    assert env[run.DIGEST_ENV] == "openai/gpt-6-luna"  # Luna rows can be complete

    no_keys.delenv("ANTHROPIC_API_KEY")
    env = run.judge_env(PUBLISHED, None, batch=False)
    assert run.judge_route(env) == "openrouter"
    with pytest.raises(SystemExit, match="--batch needs ANTHROPIC_API_KEY"):
        run.judge_env(PUBLISHED, None, batch=True)

    no_keys.delenv("OPENROUTER_API_KEY")
    with pytest.raises(SystemExit, match="set ANTHROPIC_API_KEY or OPENROUTER_API_KEY"):
        run.judge_env(PUBLISHED, None, batch=False)


def test_fast_version_families():
    assert FAST["fast"] == "safety" and FAST["fastSubset"] == "fast-safety-v1"
    assert len(FAST["families"]) == len(set(FAST["families"])) == 24
    assert set(FAST["smoke"]["families"]) <= set(FAST["families"])
    assert "maxPromptTokens" not in FAST  # a fast subset is defined on full reads only


def test_versions_and_families_agree():
    inst = PUBLISHED
    rules = json.loads((HERE / "submission" / "rules.json").read_text())
    seed = json.loads((REPO / "data" / "seed" / "evals" / "workspacebench.json").read_text())
    version = next(v for v in seed["versions"] if v["version"] == inst["version"])
    assert rules["evals"] == {run.EVAL: inst["version"]}
    assert rules["results"] == run.RESULTS_SCHEMA
    assert rules["models"] == [run.FULL_MODEL]
    keys = {m["key"] for m in version["metrics"]} - {"macro_score"}
    assert set(inst["families"]) == keys
    assert {s["name"] for s in version["dataset"]["splits"]} == keys
    assert not set(inst["later"]) & keys
    assert set(inst["smoke"]["families"]) <= keys
    assert set(inst["notRun"]).isdisjoint(set(inst["families"]) | set(inst["later"]))


def test_readouts_name_both_choices():
    assert set(run.READOUTS) == {"norm", "cosine"}
