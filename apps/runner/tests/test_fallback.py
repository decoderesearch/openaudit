"""The slot model with fallbacks, and how ingest counts the fallback calls."""

import asyncio
from types import SimpleNamespace

from inspect_ai.model import ModelOutput, get_model

from openaudit_runner.fallback import FallbackModel
from openaudit_runner.ingest import fallback_calls, other_models


def mock(name, outputs):
    return get_model(f"mockllm/{name}", custom_outputs=outputs, memoize=False)


def fails():
    raise RuntimeError("403 flagged")
    yield


def test_errors_and_refusals_go_to_the_next_model():
    ok = ModelOutput.from_content("mockllm/c", "fine")
    model = FallbackModel(
        [
            mock("a", fails()),
            mock(
                "b",
                [
                    ModelOutput.from_content(
                        "mockllm/b", "", stop_reason="content_filter"
                    )
                ],
            ),
            mock("c", [ok]),
        ]
    )
    out = asyncio.run(model.generate("hi"))
    assert out.completion == "fine"
    assert str(model) == "mockllm/a"


def test_the_last_reply_when_all_refuse():
    empty = ModelOutput.from_content("mockllm/b", "")
    model = FallbackModel([mock("a", fails()), mock("b", [empty])])
    assert asyncio.run(model.generate("hi")).completion == ""


def test_roles_go_to_each_model():
    model = FallbackModel([mock("a", []), mock("b", [])])
    model._set_role("judge_2")
    assert [m.role for m in model.models] == ["judge_2", "judge_2"]


def event(model, role, error=None):
    return SimpleNamespace(event="model", model=model, role=role, error=error)


def test_fallback_calls_by_slot():
    slots = [
        {"id": "judge", "taskArg": "judge", "default": "x/y"},
        {"id": "judge_2", "inspectRole": "grader", "default": "x/y"},
    ]
    settings = {
        "models": {
            "judge": {"model": "a/one", "fallbacks": ["b/two", "c/three"]},
            "judge_2": {"model": "b/two", "fallbacks": ["a/one"]},
        }
    }
    sample = SimpleNamespace(
        events=[
            event("openrouter/a/one", "judge", error="403"),
            event("openrouter/b/two", "judge"),
            event("openrouter/b/two", "judge"),
            event("openrouter/b/two", "grader"),
            event("openrouter/a/one", "grader"),
            event("openrouter/target", None),
        ]
    )
    calls = fallback_calls(sample, slots, settings)
    assert calls == {("judge", "b/two"): 2, ("judge_2", "a/one"): 1}
    used = [{"slot": s, "model": m, "calls": n} for (s, m), n in sorted(calls.items())]
    assert other_models(settings, slots, used) == (
        "judge: a/one (fallback b/two: 2 calls), judge_2: b/two (fallback a/one: 1 call)"
    )
