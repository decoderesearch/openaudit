"""The model ladders from spec/model-ladders.yaml."""

from openaudit_runner.ladders import (
    LADDERS,
    good_enough,
    lab,
    model_id,
    role_models,
    slot_models,
    slot_ok,
    tier_models,
    tier_routes,
)


def test_lab_uses_the_prefix_and_the_aliases():
    assert lab("anthropic/claude-sonnet-5.5") == "anthropic"
    assert lab("openrouter/meta-llama/llama-3.3-70b-instruct") == "meta"
    assert lab("Qwen/Qwen3.6-27B") == "qwen"


def test_roles_skip_the_target_lab():
    assert (
        role_models("aggregator", "anthropic/claude-haiku-4.5")[0]
        == "openai/gpt-6.1-sol"
    )
    assert (
        role_models("aggregator", "Qwen/Qwen3.6-27B")[0]
        == "anthropic/claude-sonnet-5.5"
    )
    assert "x-ai/grok-4.3" not in role_models("flagger", "xai/grok-5")
    assert role_models("flagger")[0] == "openai/gpt-6-luna"
    assert role_models("flagger", "openai/gpt-oss-20b")[0] == "x-ai/grok-4.3"


def test_each_tier_gives_a_model_to_each_lab():
    for name, tier in LADDERS["tiers"].items():
        for m in tier["models"]:
            assert tier_models(name, m), f"{name} has no model for {m}"


def test_model_id_and_lab_drop_provider_prefixes():
    assert model_id("openrouter/anthropic/claude-x:beta") == "anthropic/claude-x"
    assert model_id("vllm/Qwen/Qwen3.6-27B") == "qwen/qwen3.6-27b"
    assert (
        model_id("openai-api/pod/prism-ml/Ternary-Bonsai-27B")
        == "prism-ml/ternary-bonsai-27b"
    )
    assert lab("vllm/Qwen/Qwen3.6-27B") == "qwen"


def test_good_enough_is_the_tier_and_the_tiers_above():
    fast = good_enough("fast")
    assert fast[: len(tier_models("fast"))] == tier_models("fast")
    assert set(tier_models("premium")) <= set(fast)
    assert not set(tier_models("fast")) - set(tier_models("standard")) & set(
        good_enough("standard")
    )


JUDGE = {"id": "judge", "default": "meta-llama/llama-3.1-8b-instruct", "tier": "fast"}


def test_slot_models_skip_the_target_lab_and_prefer_the_slot_lab():
    models = slot_models(JUDGE, "google/gemini-3.5-flash-lite")
    assert models and all(lab(m) != "google" for m in models)
    assert (
        slot_models({**JUDGE, "labs": ["x-ai"]}, "qwen/qwen3.8-27b")[0] == "x-ai/grok-4.3"
    )
    assert slot_models({**JUDGE, "tier": None}, "a/b") == []


def test_slot_labs_are_tried_in_order():
    slot = {**JUDGE, "tier": "standard", "labs": ["openai", "google"]}
    assert [lab(m) for m in slot_models(slot, "qwen/qwen3.8-27b")][:2] == ["openai", "google"]
    assert lab(slot_models(slot, "openai/gpt-6-luna")[0]) == "google"


def test_same_lab_slots_never_use_the_target_model():
    slot = {**JUDGE, "sameLab": True}
    models = slot_models(slot, "openai/gpt-6-luna")
    assert "openai/gpt-6-luna" not in models
    assert slot_ok(slot, "google/gemini-3.8-flash", "google/gemini-3.5-flash-lite")
    assert not slot_ok(slot, "openai/gpt-6-luna", "openai/gpt-6-luna")


def test_slot_ok():
    target = "openai/gpt-6-luna"
    assert slot_ok(JUDGE, "google/gemini-3.8-flash", target)
    assert slot_ok(JUDGE, "anthropic/claude-sonnet-5.5", target)  # a higher tier
    assert not slot_ok(JUDGE, "meta-llama/llama-3.1-8b-instruct", target)
    assert not slot_ok(JUDGE, "openai/gpt-6.1-sol", target)  # the target's lab
    untiered = {"id": "j", "default": "a/b"}
    assert slot_ok(untiered, "a/b", target) and not slot_ok(untiered, "c/d", target)


def test_tier_routes_keep_a_panel_apart():
    panel = [
        {
            "id": f"judge_{i}",
            "default": "x/y",
            "tier": "standard",
            "sameLab": True,
            "labs": [lab_],
        }
        for i, lab_ in enumerate(["anthropic", "openai", "google"], 1)
    ]
    routes = tier_routes(panel, "qwen/qwen3.8-27b")
    firsts = [routes[s["id"]]["model"] for s in panel]
    assert [lab(m) for m in firsts] == ["anthropic", "openai", "google"]
    for s in panel:
        fb = routes[s["id"]]["fallbacks"]
        assert fb[0] not in firsts  # a model of no other slot first
