"""The Petri judge panel and the auditor rule. Mock models only; no network."""

import math

import pytest
from inspect_ai import Task
from inspect_ai import eval as inspect_eval
from inspect_ai.dataset import MemoryDataset, Sample
from inspect_ai.model import Model, get_model
from inspect_ai.scorer import Score, Scorer, Target, scorer
from inspect_ai.solver import TaskState, generate
from openaudit_runner import ingest
from openaudit_runner import ingest
from openaudit_runner import inspect_map as im
from openaudit_runner.auditor import OTHER_AUDITORS, auditor_problem, check_auditors
from openaudit_runner.petri_task import judge_panel, panel_score
from openaudit_runner.work import loose_tools

DIMS = ["concerning", "admirable"]
# What each mock judge gives, by model name. The broken judge fails on every sample.
GIVES = {
    "mockllm/a": {"concerning": 2, "admirable": 6},
    "mockllm/b": {"concerning": 4, "admirable": 8},
}


def fake_judge(model: Model) -> Scorer:
    @scorer(metrics=[])
    def judge() -> Scorer:
        async def score(state: TaskState, target: Target) -> Score:
            if str(model) not in GIVES:
                raise RuntimeError("judge down")
            return Score(value=dict(GIVES[str(model)]), explanation=f"by {model}")

        return score

    return judge()


def run_panel(tmp_path, roles: dict[str, str]):
    task = Task(
        dataset=MemoryDataset([Sample(id="s1", input="Hi"), Sample(id="s2", input="Yo")]),
        solver=generate(),
        scorer=judge_panel(fake_judge, DIMS),
    )
    [log] = inspect_eval(
        task,
        model="mockllm/model",
        model_roles={r: get_model(m) for r, m in roles.items()},
        log_dir=str(tmp_path),
        display="none",
    )
    return log


def test_panel_mean_and_each_judge(tmp_path):
    log = run_panel(
        tmp_path, {"judge": "mockllm/a", "judge_2": "mockllm/b", "judge_3": "mockllm/down"}
    )
    assert log.status == "success"
    value = log.samples[0].scores["audit_judge"].value
    assert value["concerning"] == 3 and value["admirable"] == 7
    assert value["concerning@judge"] == 2 and value["concerning@judge_2"] == 4
    assert math.isnan(value["concerning@judge_3"])
    judges = log.samples[0].scores["audit_judge"].metadata["judges"]
    assert "judge down" in judges["judge_3"]["error"]

    log.eval.task = "openaudit_runner/petri"
    got = {r["metric"]: r for r in im.results(log, [{"key": "concerning_mean", "min": 1, "max": 10}])}
    assert got["concerning_mean"]["value"] == 3
    assert got["concerning_mean@judge_2"]["value"] == 4
    assert got["concerning_mean@judge_2"]["unit"] == "score"
    assert "concerning_mean@judge_3" not in got
    scores = im.score_values(log.samples[0])
    assert scores["audit_judge/concerning@judge_2"] == {"value": 4}
    assert "audit_judge/concerning@judge_3" not in scores


def test_panel_uses_the_roles_the_run_has(tmp_path):
    log = run_panel(tmp_path, {"judge": "mockllm/b"})
    value = log.samples[0].scores["audit_judge"].value
    assert value == {"concerning": 4, "admirable": 8, "concerning@judge": 4, "admirable@judge": 8}


def test_panel_fails_when_all_judges_fail():
    with pytest.raises(RuntimeError, match="All judges failed"):
        panel_score({"judge": ("m", RuntimeError("x")), "judge_2": ("n", None)}, DIMS)


def test_bloom_metric_names_for_each_judge():
    keys = im.METRIC_KEYS["openaudit_runner/bloom"]
    task = "openaudit_runner/bloom"
    raw = "delusion_sycophancy@judge_3/openaudit_runner/elicitation_rate"
    assert im.metric_key(task, raw, keys) == "elicitation_rate@judge_3"
    assert im.metric_key(task, "delusion_sycophancy/mean", keys) == "mean_behavior_presence"


SLOTS = [
    {"id": "auditor", "role": "auditor", "inspectRole": "auditor", "default": "x"},
    {"id": "judge", "role": "judge", "inspectRole": "judge", "default": "y", "scoring": True},
]


def routes(auditor: str, judge: str = "openai/gpt-6.1-sol"):
    return {
        "auditor": {"kind": "openrouter", "model": auditor, "allowFallbacks": True},
        "judge": {"kind": "openrouter", "model": judge, "allowFallbacks": True},
    }


def test_auditor_is_never_the_target():
    assert auditor_problem("openai/gpt-6-luna", "openrouter/openai/gpt-6-luna")
    assert auditor_problem("qwen/qwen3.6-27b", "openai/gpt-6-luna") is None
    out = check_auditors(SLOTS, routes("openai/gpt-6-luna"), "openai/gpt-6-luna", set())
    assert out["auditor"]["model"] == OTHER_AUDITORS[1]
    assert out["judge"]["model"] == "openai/gpt-6.1-sol"


def test_claude_target_gets_an_auditor_from_another_family():
    target = "anthropic/claude-sonnet-5.5"
    assert auditor_problem(target, "anthropic/claude-haiku-4.5")
    out = check_auditors(SLOTS, routes("anthropic/claude-sonnet-4.6"), target, set())
    assert not out["auditor"]["model"].startswith("anthropic/")
    # A judge may be from the target's family; the panel has other families too.
    assert check_auditors(SLOTS, routes("openai/gpt-6-luna", target), target, set()) == routes(
        "openai/gpt-6-luna", target
    )


def test_a_chosen_auditor_that_breaks_the_rule_fails():
    with pytest.raises(ValueError, match="Claude"):
        check_auditors(
            SLOTS, routes("anthropic/claude-opus-5.5"), "anthropic/claude-sonnet-5.5", {"auditor"}
        )


def test_estimated_cost_prices_cache_tokens(monkeypatch):
    monkeypatch.setattr(ingest, "openrouter_prices", lambda: {"a/b": (1.0, 2.0, 0.1, 1.25)})
    tokens = {"input": 100, "output": 10, "cacheRead": 80, "cacheWrite": 10}
    assert ingest.estimate_cost("openrouter/a/b", tokens) == pytest.approx(10 + 20 + 8 + 12.5)
    assert ingest.estimate_cost("openrouter/a/b", {"input": 100, "output": 10}) == 120


def test_estimated_cost_prices_cache_tokens(monkeypatch):
    monkeypatch.setattr(ingest, "openrouter_prices", lambda: {"a/b": (1.0, 2.0, 0.1, 1.25)})
    tokens = {"input": 100, "output": 10, "cacheRead": 80, "cacheWrite": 10}
    assert ingest.estimate_cost("openrouter/a/b", tokens) == pytest.approx(10 + 20 + 8 + 12.5)
    assert ingest.estimate_cost("openrouter/a/b", {"input": 100, "output": 10}) == 120


def test_auditor_evals_turn_off_strict_tools():
    assert loose_tools({"models": SLOTS}) == {"strict_tools": False}
    assert loose_tools({"models": SLOTS[1:]}) == {}
    assert loose_tools({}) == {}
