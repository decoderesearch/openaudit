"""FACTS Grounding parsers and metrics. No network."""

from inspect_ai.scorer import SampleScore, Score
from openaudit_runner import facts_task as ft


def test_json_grounded_only_if_all_supported_or_no_rad():
    ok = (
        '{"sentence": "A.", "label": "supported", "excerpt": "A"}\n'
        '{"sentence": "Hi!", "label": "no_rad", "excerpt": null}'
    )
    assert ft.parse_structured_json(ok)[0] is True
    assert ft.parse_structured_json(f"```json\n{ok}\n```")[0] is True
    bad = ok + '\n{"sentence": "B.", "label": "unsupported", "excerpt": null}'
    assert ft.parse_structured_json(bad)[0] is False
    grounded, parsed = ft.parse_structured_json("No JSON here.")
    assert grounded is False and parsed == []
    assert ft.parse_structured_json('{"sentence": "A."}')[0] is False


def test_request_mismatch():
    prompt = "Answer from the text.\n\nText: ...\n\nHow did  verbal ability\nchange the results?"
    assert not ft.request_mismatch(prompt, "How did verbal ability change the results?")
    assert not ft.request_mismatch(prompt, "how did verbal ability change the results?")
    assert ft.request_mismatch(prompt, "What is oxytocin therapy?")


def test_implicit_span_final_answer():
    assert ft.parse_implicit_span("Sentence 1 label: Accurate\nFinal Answer: Accurate")
    assert (
        ft.parse_implicit_span("Sentence 1 label: Accurate\nFinal Answer: Inaccurate")
        is False
    )
    assert ft.parse_implicit_span("Sentence 1 label: Accurate") is None
    assert ft.parse_implicit_span("Final Answer: unclear") is None


def test_eligibility_parse_failure_is_invalid():
    major = (
        'Analysis...\n```json\n{\n  "Instruction Following": "Major Issue(s)"\n}\n```'
    )
    assert ft.parse_eligibility(major) == "Major Issue(s)"
    assert ft.parse_eligibility('{"Instruction Following": "No Issues"}') == "No Issues"
    assert ft.parse_eligibility("Analysis only.") == "Invalid"
    assert ft.parse_eligibility('{"Instruction Following": "Bad"}') == "Invalid"
    assert ft.parse_eligibility("```json\n[1, 2]\n```") == "Invalid"
    # The template shows double braces; a judge that copies them does not parse.
    copied = '```json\n{{\n  "Instruction Following": "Major Issue(s)"\n}}\n```'
    assert ft.parse_eligibility(copied) == "Invalid"


def test_breakdown_per_judge_and_unadjusted():
    def s(eligible: int, by_judge: list[int]) -> SampleScore:
        unadjusted = sum(by_judge) / 3
        return SampleScore(
            score=Score(
                value=eligible * unadjusted,
                metadata={
                    "eligible": eligible,
                    "grounded_by_judge": by_judge,
                    "unadjusted": unadjusted,
                },
            )
        )

    out = ft.facts_breakdown()([s(1, [1, 1, 0]), s(0, [1, 1, 1])])
    assert out == {
        "judge_1": 0.5,
        "judge_2": 0.5,
        "judge_3": 0.0,
        "unadjusted": (2 / 3 + 1) / 2,
        "ineligible_rate": 0.5,
    }
