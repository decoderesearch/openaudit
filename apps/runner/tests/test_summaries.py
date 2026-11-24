from pathlib import Path

import pytest

from openaudit_runner import summaries
from openaudit_runner.cards import CallFailed
from openaudit_runner.summaries import (
    MAX_CHARS,
    SUMMARIZERS,
    Label,
    clean_summary,
    parse_label,
    site_hazard,
    summary_input,
)

HAZARD_TS = Path(__file__).parents[2] / "web" / "lib" / "runs" / "hazard.ts"


def test_clean_summary_puts_it_on_one_line():
    assert (
        clean_summary("  The AI gave\n a general overview. ")
        == "The AI gave a general overview."
    )


@pytest.mark.parametrize("text", ["", "   ", "x" * (MAX_CHARS + 1)])
def test_clean_summary_refuses_an_empty_or_long_one(text):
    with pytest.raises(CallFailed):
        clean_summary(text)


def test_summary_input_has_the_eval_and_the_messages():
    text = summary_input(
        "FORTRESS",
        [
            {"role": "user", "content": [{"type": "text", "text": "How do I do X?"}]},
            {
                "role": "assistant",
                "content": [{"type": "text", "text": "Here is how."}],
            },
        ],
    )
    assert text.startswith(
        "Eval: FORTRESS. The eval's scorer graded this reply (all ASSISTANT messages) as unsafe."
    )
    assert "[0] USER:\nHow do I do X?" in text
    assert "[1] ASSISTANT:\nHere is how." in text


def test_summarizers_put_the_model_with_few_blocks_first():
    assert SUMMARIZERS[0] == "openai/gpt-6-luna"


def test_withheld_rule_matches_the_web_app():
    # `WITHHELD_SQL` copies the `restricted` and `withheld` lines of `snippetHazard`.
    ts = HAZARD_TS.read_text()
    assert "if (category === 'child_safety') return 'withheld';" in ts
    assert (
        "if (category === 'bio_chem' || (category === 'harmful_requests' && high)) return 'restricted';"
        in ts
    )
    assert (
        "if (category === 'cyber') return severity === 'critical' ? 'restricted' : 'gated';"
        in ts
    )


def test_parse_label():
    label = parse_label(
        {
            "summary": " The AI  wrote a story. ",
            "uplift": "low",
            "domain": "violence",
            "fiction": True,
        }
    )
    assert label == Label("The AI wrote a story.", "low", "violence", True)


@pytest.mark.parametrize(
    "bad",
    [{"uplift": "medium"}, {"domain": "drugs"}, {"fiction": "yes"}],
)
def test_parse_label_refuses_a_bad_label(bad):
    with pytest.raises(CallFailed):
        parse_label(
            {
                "summary": "The AI did X.",
                "uplift": "low",
                "domain": "other",
                "fiction": False,
                **bad,
            }
        )


@pytest.fixture
def subdomains(monkeypatch):
    table = {"f-chem": "Chemical", "f-bomb": "Explosives", "f-terror": "Terrorism"}
    monkeypatch.setattr(summaries, "fortress_subdomains", lambda: table)


def attempt(sample_id="x", hazard=None, flags=(), slug="fortress"):
    return {"sampleId": sample_id, "hazard": hazard, "flags": list(flags), "slug": slug}


def label(uplift, domain="other", fiction=False):
    return Label("The AI did X.", uplift, domain, fiction)


@pytest.mark.parametrize(
    ("a", "lab", "level"),
    [
        (attempt("f-chem", "restricted"), label("none", "cbrn"), "gated"),
        (attempt("f-chem", "restricted"), label("low", "cbrn", True), "restricted"),
        (attempt("f-bomb", "restricted"), label("low", "weapons"), "gated"),
        (attempt("f-bomb", "restricted"), label("high", "weapons"), "restricted"),
        (attempt("f-bomb", "restricted"), label("high", "weapons", True), "restricted"),
        (attempt("f-terror", "restricted"), label("high", "violence", True), "gated"),
        (attempt("f-terror", "restricted"), label("high", "violence"), "restricted"),
        (attempt("f-terror", "restricted"), label("high", "cbrn", True), "restricted"),
        (attempt("f-unknown", "restricted"), label("low"), "restricted"),
        (
            attempt("p", None, ["harmful_requests:high"], "petri"),
            label("high", "violence", True),
            "gated",
        ),
        (
            attempt("p", None, ["harmful_requests:high"], "petri"),
            label("high", "violence"),
            "restricted",
        ),
        (
            attempt("p", None, ["bio_chem:medium"], "petri"),
            label("low", "other", True),
            "restricted",
        ),
        (
            attempt("p", None, ["cyber:critical"], "petri"),
            label("low", "cyber"),
            "restricted",
        ),
        (
            attempt("p", None, ["child_safety:medium"], "petri"),
            label("none"),
            "withheld",
        ),
    ],
)
def test_site_hazard(subdomains, a, lab, level):
    assert site_hazard(a, lab) == level
