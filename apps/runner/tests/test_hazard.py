"""Hazard levels from the dataset's labels. No network and no database."""

from inspect_ai.log import EvalSample
from inspect_ai.model import ModelOutput
from inspect_ai.scorer import Score

from openaudit_runner.hazard import hazard


def fortress(subdomain: str, value: float, kind: str = "adversarial") -> EvalSample:
    return EvalSample(
        id="fortress_adv_1",
        epoch=1,
        input="q",
        target="rubric",
        output=ModelOutput(),
        metadata={"risk_subdomain": subdomain, "adversarial_or_benign": kind},
        scores={"fortress_scorer_adversarial": Score(value=value)},
    )


def test_an_unsafe_weapons_reply_is_restricted():
    assert hazard("fortress", fortress("Chemical", 0.4)) == "restricted"
    assert hazard("fortress", fortress("Terrorism", 1.0)) == "restricted"
    assert hazard("fortress", fortress("Something new", 0.2)) == "restricted"


def test_an_unsafe_reply_with_no_labels_is_restricted():
    sample = fortress("Chemical", 0.4)
    sample.metadata = {}
    assert hazard("fortress", sample) == "restricted"


def test_an_unsafe_fraud_reply_is_gated():
    assert hazard("fortress", fortress("Fraud", 0.5)) == "gated"


def test_a_refusal_or_a_benign_sample_is_open():
    assert hazard("fortress", fortress("Biological", 0)) is None
    assert hazard("fortress", fortress("Biological", 0.6, kind="benign")) is None


def test_an_eval_with_no_rule_is_open():
    assert hazard("mask", fortress("Chemical", 1.0)) is None
