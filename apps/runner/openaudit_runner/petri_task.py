"""Petri with a panel of judges. Each judge scores every transcript; the headline value of a
dimension is the mean over the judges. Each judge's own value is also kept, as `<dim>@<role>`."""

import asyncio
import math
from collections.abc import Callable
from typing import Any

from inspect_ai import Task, task, task_with
from inspect_ai.model import Model, get_model, model_roles
from inspect_ai.scorer import Metric, Score, Scorer, Target, mean, scorer, stderr
from inspect_ai.solver import TaskState

# The Inspect model roles of the panel, in slot order. A run fills the roles its version has.
JUDGE_ROLES = ("judge", "judge_2", "judge_3")


def judge_panel(
    make_judge: Callable[[Model], Scorer],
    dimensions: list[str],
    metrics: dict[str, list[Metric]] | None = None,
) -> Scorer:
    """A scorer that runs `make_judge` with the model of each judge role, at the same time.

    A judge that fails or refuses gives NaN for its values (Inspect leaves NaN out of the
    metrics). When all judges fail, the sample fails.
    """

    @scorer(metrics=metrics or {"*": [mean(), stderr()]}, name="audit_judge")
    def panel() -> Scorer:
        judges: dict[str, tuple[Model, Scorer]] = {}

        async def score(state: TaskState, target: Target) -> Score:
            roles = [r for r in JUDGE_ROLES if r in model_roles()]
            if not roles:
                raise RuntimeError("The run has no judge model.")
            for role in roles:
                if role not in judges:
                    model = get_model(role=role, required=True)
                    judges[role] = (model, make_judge(model))
            done = await asyncio.gather(
                *(judges[r][1](state, target) for r in roles), return_exceptions=True
            )
            return panel_score(
                {r: (str(judges[r][0]), s) for r, s in zip(roles, done)}, dimensions
            )

        return score

    return panel()


def panel_score(
    judged: dict[str, tuple[str, Score | BaseException | None]], dimensions: list[str]
) -> Score:
    """One score from the judges' scores, by role: the mean of each dimension, and each
    judge's value as `<dim>@<role>`."""
    nan = float("nan")
    values: dict[str, dict[str, float]] = {}
    about: dict[str, dict[str, Any]] = {}
    for role, (model, s) in judged.items():
        info: dict[str, Any] = {"model": model}
        if isinstance(s, BaseException):
            info["error"] = f"{type(s).__name__}: {s}"[:1000]
        elif s is None or not isinstance(s.value, dict):
            info["error"] = (s.explanation if s else None) or "The judge gave no scores."
        if "error" in info:
            values[role] = dict.fromkeys(dimensions, nan)
        else:
            assert isinstance(s, Score) and isinstance(s.value, dict)
            values[role] = {d: number(s.value.get(d)) for d in dimensions}
            info["explanation"] = s.explanation
            info.update({k: v for k, v in (s.metadata or {}).items() if k != "scanner_references"})
        about[role] = info
    if all("error" in a for a in about.values()):
        raise RuntimeError(
            "All judges failed. " + " ".join(f"{r}: {a['error']}" for r, a in about.items())
        )
    value: dict[str, float] = {}
    for d in dimensions:
        given = [v[d] for v in values.values() if not math.isnan(v[d])]
        value[d] = sum(given) / len(given) if given else nan
    for role, v in values.items():
        value.update({f"{d}@{role}": v[d] for d in dimensions})
    explanation = "\n\n".join(
        f"{role} ({a['model']}): {a.get('explanation') or a.get('error') or ''}".strip()
        for role, a in about.items()
    )
    return Score(value=value, explanation=explanation, metadata={"judges": about})


def number(v: Any) -> float:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else float("nan")


@task
def petri(
    seed_instructions: str | list[str] | None = None,
    max_turns: int = 30,
    enable_prefill: bool = False,
    enable_rollback: bool = True,
    target_tools: str = "synthetic",
    realism_filter: bool | float = False,
    judge_dimensions: str | list[str] | None = None,
) -> Task:
    """`inspect_petri/audit` with the same defaults, scored by the judge panel."""
    from inspect_petri import audit, audit_judge
    from inspect_petri import judge_dimensions as resolve
    from inspect_scout import as_scorer

    base = audit(
        seed_instructions=seed_instructions,
        max_turns=max_turns,
        enable_prefill=enable_prefill,
        enable_rollback=enable_rollback,
        target_tools=target_tools,  # type: ignore[arg-type]
        realism_filter=realism_filter,
        judge_dimensions=judge_dimensions,
    )
    names = [d.name for d in resolve(judge_dimensions)]

    def make_judge(model: Model) -> Scorer:
        return as_scorer(audit_judge(judge_dimensions, model=model))

    return task_with(base, scorer=judge_panel(make_judge, names))
