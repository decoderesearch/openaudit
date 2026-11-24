"""Each example round-trips through the generated Pydantic models; each invalid example fails."""

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import openaudit_spec as spec
import pytest
from pydantic import ValidationError

EXAMPLES = Path(__file__).parent.parent / "examples"
RECORDS = ["Organization", "Document", "Model", "Eval", "EvalVersion", "EvalSample", "SystemCard", "EvalResult", "EvalRun", "EvalAttempt", "Transcript", "OpenAuditCardVersion", "OpenAuditSnippet", "OrgIncident", "OrgIncidentEvent", "OrgDeparture"]
TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$")


def load(name: str) -> Any:
    return json.loads((EXAMPLES / name).read_text())


def same_instant(x: Any) -> Any:
    """Timestamps compare by instant: `...11.000Z` and `...11Z` are equal."""
    if isinstance(x, dict):
        return {k: same_instant(v) for k, v in x.items()}
    if isinstance(x, list):
        return [same_instant(v) for v in x]
    if isinstance(x, str) and TIMESTAMP.match(x):
        return datetime.fromisoformat(x.replace("Z", "+00:00"))
    return x


VALID = [(t, r) for t in RECORDS for r in load(f"{t}.json")]
INVALID = load("invalid.json")


@pytest.mark.parametrize(("type_name", "record"), VALID, ids=[f"{t}:{r['id']}" for t, r in VALID])
def test_round_trip(type_name: str, record: dict) -> None:
    model = getattr(spec, type_name).model_validate(record)
    out = json.loads(model.model_dump_json())
    assert same_instant(out) == same_instant(record)
    assert isinstance(spec.SpecRecord.model_validate(record).root, getattr(spec, type_name))


@pytest.mark.parametrize("case", INVALID, ids=[c["why"] for c in INVALID])
def test_refuses(case: dict) -> None:
    if case.get("jsonSchemaOnly"):
        pytest.skip("Pydantic does not check dependentRequired.")
    with pytest.raises(ValidationError):
        getattr(spec, case["type"]).model_validate(case["record"])
