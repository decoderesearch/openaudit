"""Finds provider blocks in model call errors: a provider refused the call for its policy, so the
sample has no score. This is not the model's own refusal. `ProviderBlock` in the spec."""

import re
from collections import Counter
from collections.abc import Iterable
from typing import Any

# Codes and words that say the provider blocked the account, not one prompt.
ACCOUNT = ("user_blocked", "account_blocked", "access has been restricted", "account has been suspended")
# Known codes win over the regex: a cut error text can end in the middle of a code.
CODES = ("user_blocked", "account_blocked", "data_inspection_failed", "permission-denied", "content_filter")
PROVIDER = re.compile(r"provider_name[\\'\": ]+([A-Za-z0-9][A-Za-z0-9 ._-]*?)[\\'\"]")
ORDER = re.compile(r"\"order\": \[\s*\"([^\"]+)\"")
CODE = re.compile(r"(?:provider_error_code[\\'\": ]+|\"code\": ?\")([A-Za-z][A-Za-z0-9_-]+)")
MESSAGE = re.compile(r"\"(?:message|error)\": ?\"((?:[^\"\\]|\\.){4,300}?)\"")
MODEL = re.compile(r"\"model\": \"([^\"]+)\"")
STATUS = re.compile(r"Error(?: code:)? (\d{3})")
GENERIC = {"Provider returned error"}
# A provider's filter blocked one reply: "Gemini blocked the response: OTHER". OpenRouter
# sends it as a server error.
REPLY = re.compile(r"\b(\w+) blocked the response: ([A-Z_]+)")
REPLY_PROVIDERS = {"Gemini": "Google"}


def reply_blocked(error: str) -> bool:
    """True when a provider's filter blocked the reply. A retry of the call gets the same block."""
    return REPLY.search(error) is not None


def classify(error: str) -> dict[str, Any] | None:
    """The block that an error message states, or None when it is not a policy block."""
    low = error.lower()
    model = MODEL.search(error)
    if "biological risk" in low:
        block = {"provider": "OpenAI", "kind": "content", "code": "bio_risk",
                 "message": "This content was flagged for possible biological risk."}
    elif reply := REPLY.search(error):
        block = {"provider": REPLY_PROVIDERS.get(reply[1], reply[1]), "kind": "content",
                 "code": reply[2].lower(), "message": reply[0]}
    else:
        status = [int(s) for s in STATUS.findall(error)]
        provider = PROVIDER.search(error) or ORDER.search(error)
        codes = [c for c in CODES if c in low] or [c for c in CODE.findall(error) if not c.isdigit()]
        policy = any(w in low for w in ACCOUNT) or "data_inspection_failed" in low or (
            403 in status and PROVIDER.search(error) is not None
        )
        if not policy:
            return None
        messages = [m for m in MESSAGE.findall(error) if m not in GENERIC]
        block = {
            "provider": provider[1] if provider else "unknown",
            "kind": "account" if any(w in low for w in ACCOUNT) else "content",
            **({"code": codes[-1]} if codes else {}),
            **({"message": re.sub(r"\\+'", "'", messages[-1])[:300]} if messages else {}),
        }
    return block | ({"model": model[1]} if model else {})


def summarize(errors: Iterable[str]) -> list[dict[str, Any]]:
    """One `ProviderBlock` for each provider, kind, code and model, with its sample count."""
    count: Counter[tuple[str, ...]] = Counter()
    first: dict[tuple[str, ...], dict[str, Any]] = {}
    for error in errors:
        if block := classify(error):
            key = tuple(str(block.get(k, "")) for k in ("provider", "kind", "code", "model"))
            count[key] += 1
            first.setdefault(key, block)
    return [first[k] | {"samples": n} for k, n in count.most_common()]


def note(blocks: list[dict[str, Any]]) -> str:
    """One short line for a run error, for example "Meta blocked the account (user_blocked)"."""
    parts = []
    for b in blocks:
        what = "blocked the account" if b["kind"] == "account" else "refused the content"
        parts.append(f"{b['provider']} {what}" + (f" ({b['code']})" if b.get("code") else ""))
    return "; ".join(dict.fromkeys(parts)) + "." if parts else ""
