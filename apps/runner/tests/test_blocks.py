"""Provider blocks from model call errors, with error texts as OpenRouter gives them."""

from openaudit_runner.blocks import classify, note, summarize

REQUEST = '\nRequest:\n{\n  "messages": [],\n  "model": "%s",\n  "extra_body": {\n    "provider": {\n      "order": [\n        "%s"\n      ]\n    }\n  }\n}\n\n'
META = (
    "ModelGenerateError('" + REQUEST % ("meta/muse-spark-1.3", "Meta")
    + "PermissionDeniedError(\\'Error code: 403 - {\\\\\\'error\\\\\\': {\\\\\\'message\\\\\\': \\\\\\'Provider returned error\\\\\\', "
    "\\\\\\'code\\\\\\': 403, \\\\\\'metadata\\\\\\': {\\\\\\'raw\\\\\\': \\\\\\'{\"error\":{\"code\":\"user_blocked\",\"message\":"
    "\"Your access has been restricted due to repeated policy violations.\",\"param\":null,\"type\":\"permission_error\"}}\\\\\\', "
    "\\\\\\'provider_name\\\\\\': \\\\\\'Meta\\\\\\', \\\\\\'is_byok\\\\\\': False}}}\\')')"
)
XAI = (
    "ModelGenerateError('" + REQUEST % ("x-ai/grok-4.3", "xAI")
    + "PermissionDeniedError(\\'Error code: 403 - {\\\\\\'error\\\\\\': {\\\\\\'message\\\\\\': \\\\\\'Provider returned error\\\\\\', "
    "\\\\\\'code\\\\\\': 403, \\\\\\'metadata\\\\\\': {\\\\\\'raw\\\\\\': \\\\\\'{\"code\":\"permission-denied\",\"error\":\"I\\\\\\\\\\\\\\'m sorry, "
    "I can\\\\\\\\\\\\\\'t help with that request.\"}\\\\\\', \\\\\\'provider_name\\\\\\': \\\\\\'xAI\\\\\\'}}}\\')')"
)
BIO = "Error 403 - This content was flagged for possible biological risk. If this seems wrong, try rephrasing your request."
ALIBABA = (
    "ModelGenerateError('" + REQUEST % ("qwen/qwen3.8-27b", "Alibaba")
    + "BadRequestError(\\'Error code: 400 - {\\\\\\'error\\\\\\': {\\\\\\'message\\\\\\': \\\\\\'Provider returned error\\\\\\', "
    "\\\\\\'metadata\\\\\\': {\\\\\\'raw\\\\\\': \\\\\\'data: {\"error\":{\"code\":\"data_inspection_failed\",\"message\":"
    "\"Input text data may contain inappropriate content.\"}}\\\\\\', \\\\\\'provider_name\\\\\\': \\\\\\'Alibaba\\\\\\'}}}\\')')"
)


def test_classify_known_blocks():
    assert classify(META) == {
        "provider": "Meta",
        "kind": "account",
        "code": "user_blocked",
        "message": "Your access has been restricted due to repeated policy violations.",
        "model": "meta/muse-spark-1.3",
    }
    assert classify(XAI) == {
        "provider": "xAI",
        "kind": "content",
        "code": "permission-denied",
        "message": "I'm sorry, I can't help with that request.",
        "model": "x-ai/grok-4.3",
    }
    assert classify(BIO) == {
        "provider": "OpenAI",
        "kind": "content",
        "code": "bio_risk",
        "message": "This content was flagged for possible biological risk.",
    }
    assert classify(ALIBABA)["code"] == "data_inspection_failed"
    assert classify(ALIBABA)["kind"] == "content"


def test_a_cut_error_still_gives_the_provider_and_code():
    cut = META[: META.index("Your access") + 40]
    block = classify(cut)
    assert block["provider"] == "Meta"  # From the request's provider order.
    assert block["code"] == "user_blocked"


def test_other_errors_are_not_blocks():
    assert classify("Error code: 402 - Insufficient credits") is None
    assert classify("Error code: 429 - rate limited upstream. provider_name: 'DeepInfra'") is None
    assert classify("Error code: 503 - no provider") is None
    assert classify("RuntimeError: The runner stopped.") is None


def test_summarize_counts_samples_and_note_reads_well():
    blocks = summarize([META, META, XAI, "Error code: 503"])
    assert [(b["provider"], b["samples"]) for b in blocks] == [("Meta", 2), ("xAI", 1)]
    assert note(blocks) == "Meta blocked the account (user_blocked); xAI refused the content (permission-denied)."
    assert note([]) == ""


def test_a_blocked_reply_is_a_content_block():
    error = "server_error: Gemini blocked the response: OTHER"
    assert classify(error) == {
        "provider": "Google",
        "kind": "content",
        "code": "other",
        "message": "Gemini blocked the response: OTHER",
    }
    assert note(summarize([error, error])) == "Google refused the content (other)."
