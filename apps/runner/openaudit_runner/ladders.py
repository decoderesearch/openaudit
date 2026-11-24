"""The default models of our own LLM jobs, from `spec/model-ladders.yaml`. The web app has the
same functions (`apps/web/lib/model-ladders.ts`)."""

import json
from importlib.resources import files
from typing import Any

LADDERS: dict[str, Any] = json.loads(
    files("openaudit_spec").joinpath("model_ladders.json").read_text()
)


# Inspect provider prefixes of a route model. `openai-api` also has a service name.
PROVIDERS = ("openrouter", "vllm", "sglang", "hf", "ollama", "llama-cpp-python")


def model_id(model: str) -> str:
    """`openrouter/anthropic/claude-x:beta` and `vllm/Anthropic/Claude-X` are `anthropic/claude-x`."""
    parts = model.lower().split(":")[0].split("/")
    if parts[0] == "openai-api":
        parts = parts[2:]
    elif parts[0] in PROVIDERS and len(parts) > 2:
        parts = parts[1:]
    return "/".join(parts)


def lab(model: str) -> str:
    """`openrouter/meta-llama/llama-3.3-70b-instruct` is from the lab `meta`."""
    prefix = model_id(model).split("/")[0]
    return LADDERS["labs"].get(prefix, prefix)


def _skip_lab(models: list[str], target: str | None) -> list[str]:
    return [m for m in models if target is None or lab(m) != lab(target)]


def tier_models(tier: str, target: str | None = None) -> list[str]:
    """The tier's models, best first, without the models of the target's lab."""
    return _skip_lab(LADDERS["tiers"][tier]["models"], target)


def role_models(role: str, target: str | None = None) -> list[str]:
    """The role's models, best first, without the models of the target's lab."""
    r = LADDERS["roles"][role]
    return _skip_lab(
        r["models"] if "models" in r else LADDERS["tiers"][r["tier"]]["models"], target
    )


def good_enough(tier: str) -> list[str]:
    """The models of the tier and of the tiers above it (tiers are listed best first)."""
    names = list(LADDERS["tiers"])
    above = names[: names.index(tier) + 1]
    out: list[str] = []
    for t in [tier, *reversed(above[:-1])]:
        out += [m for m in LADDERS["tiers"][t]["models"] if m not in out]
    return out


def _allowed(slot: dict[str, Any], model: str, target: str) -> bool:
    if model_id(model) == model_id(target):
        return False
    return bool(slot.get("sameLab")) or lab(model) != lab(target)


def slot_models(slot: dict[str, Any], target: str) -> list[str]:
    """The slot's model for the target and then its fallbacks: the slot's tier, without the
    models that the rules do not allow, and the slot's `labs` first, in order. Empty: the slot
    has no tier."""
    if not slot.get("tier"):
        return []
    models = [m for m in tier_models(slot["tier"]) if _allowed(slot, m, target)]
    labs = slot.get("labs") or []
    return sorted(models, key=lambda m: labs.index(lab(m)) if lab(m) in labs else len(labs))


def slot_ok(slot: dict[str, Any], model: str, target: str) -> bool:
    """Whether a run's model for the slot is still good enough for the target."""
    if not slot.get("tier"):
        return model == slot["default"]
    return model in good_enough(slot["tier"]) and _allowed(slot, model, target)


def tier_routes(slots: list[dict[str, Any]], target: str) -> dict[str, dict[str, Any]]:
    """Routes for the slots with a tier. A slot's fallbacks try models that no other slot uses
    first, so that a panel of judges keeps its labs apart."""
    picks = {s["id"]: slot_models(s, target) for s in slots if s.get("tier")}
    used = {m[0] for m in picks.values() if m}
    out = {}
    for sid, models in picks.items():
        if not models:
            raise ValueError(f"No model of its tier can fill slot {sid} for {target}.")
        rest = sorted(models[1:], key=lambda m: m in used)
        out[sid] = {
            "kind": "openrouter",
            "model": models[0],
            "allowFallbacks": True,
            **({"fallbacks": rest} if rest else {}),
        }
    return out
