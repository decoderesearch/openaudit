"""FACTS Grounding v1 (Jacovi et al., arXiv 2501.03200v1) with its Kaggle starter code's judges."""

import asyncio
import json
import logging
from contextlib import suppress
from typing import Any

from inspect_ai import Task, task
from inspect_ai.dataset import Sample, hf_dataset
from inspect_ai.model import CachePolicy, Model, get_model
from inspect_ai.scorer import (
    Metric,
    SampleScore,
    Score,
    Scorer,
    Target,
    mean,
    metric,
    scorer,
    stderr,
)
from inspect_ai.solver import TaskState, generate

logger = logging.getLogger(__name__)

FACTS_REPO = "google/FACTS-grounding-public"
FACTS_REVISION = "11b6961370aa0ac73c91d58e35317e724b2ac765"

# Starter code cells 17 and 19: the grounding template of each judge, by place.
GROUNDING_TEMPLATES = ("json", "json", "implicit_span_level")
ELIGIBILITY_TEMPLATE = "ineligible_responses_filter_no_context"
ELIGIBILITY_LABELS = ("No Issues", "Minor Issue(s)", "Major Issue(s)", "Invalid")
# v1 judges are retired (Gemini 1.5 Pro, Claude 3.5 Sonnet). Place sets the template.
JUDGE_MODELS = [
    "openrouter/google/gemini-2.5-flash",
    "openrouter/openai/gpt-4o",
    "openrouter/anthropic/claude-sonnet-4.6",
]


def load_prompts() -> dict[str, str]:
    """`evaluation_prompts.csv` at the pinned revision, by `evaluation_method`."""
    from datasets import load_dataset

    rows = load_dataset(
        FACTS_REPO, "evaluation_prompts", revision=FACTS_REVISION, split="prompts"
    )
    return {r["evaluation_method"]: r["evaluation_prompt"] for r in rows}


def parse_structured_json(ans: str) -> tuple[bool, list[Any]]:
    """`parse_structured_json` (starter cell 21): grounded only if every sentence is
    `supported` or `no_rad`; nothing parsed is not grounded. A parsed line that is not an
    object with a label counts as not supported (the starter code would crash)."""
    if "```json" in ans:
        ans = ans.split("```json")[1].split("```")[0]
    ans = ans.strip()
    ans = ans.replace("}\n", "}\n@\n@\n")
    parsed_answers = []
    for line in ans.split("\n@\n@\n"):
        line = line.replace("\n", " ")
        line = line.replace("\\'", "'")
        with suppress(json.JSONDecodeError):
            parsed_answers.append(json.loads(line))
    grounded = len(parsed_answers) > 0 and all(
        isinstance(d, dict) and d.get("label") in ("supported", "no_rad")
        for d in parsed_answers
    )
    return grounded, parsed_answers


def answer_normalization(answer: str) -> bool | None:
    """`answer_normalization` (starter cell 23). None where the starter code falls to False."""
    answer = answer.strip().lower()
    if "inaccurate" in answer or "false" in answer:
        return False
    elif "accurate" in answer or "true" in answer:
        return True
    return None


def parse_implicit_span(evaluation_text: str) -> bool | None:
    """`evaluate_grounding_implicit_span` (starter cell 23): the text after the first
    `Final Answer:`. None (not grounded) when it is missing or has no verdict."""
    splits = evaluation_text.split("Final Answer:")
    if len(splits) <= 1:
        return None
    return answer_normalization(splits[1])


def parse_eligibility(ans: str) -> str:
    """`parse_json` (starter cell 26): the `Instruction Following` label, else `Invalid`."""
    parsed: Any = {}
    if "```json" in ans:
        ans = ans.split("```json")[1]
        ans = ans.split("```")[0]
    ans = ans.replace("\n", " ")
    with suppress(json.JSONDecodeError):
        parsed = json.loads(ans)
    label = parsed.get("Instruction Following") if isinstance(parsed, dict) else None
    return label if label in ELIGIBILITY_LABELS else "Invalid"


def request_mismatch(full_prompt: str, user_request: str) -> bool:
    """True when the judges' `user_request` is not in `full_prompt`, the text the model gets.
    Some public rows ask a different question in each field (#541), and some only change words."""

    def norm(s: str) -> str:
        return " ".join(s.split()).lower()

    return norm(user_request) not in norm(full_prompt)


@metric
def facts_breakdown() -> Metric:
    """Each judge's score (eligible and grounded), the score without the eligibility gate
    (paper Table 5), and the share of ineligible answers."""

    def compute(scores: list[SampleScore]) -> dict[str, float]:
        metas = [s.score.metadata or {} for s in scores]
        n = len(metas) or 1
        out = {
            f"judge_{j + 1}": sum(
                m["eligible"] * m["grounded_by_judge"][j] for m in metas
            )
            / n
            for j in range(len(GROUNDING_TEMPLATES))
        }
        out["unadjusted"] = sum(m["unadjusted"] for m in metas) / n
        out["ineligible_rate"] = sum(1 - m["eligible"] for m in metas) / n
        return out

    return compute


@scorer(metrics=[mean(), stderr(), facts_breakdown()], name="grounded")
def facts_judges(judge_models: list[str | Model]) -> Scorer:
    prompts = load_prompts()
    models = [get_model(m) for m in judge_models]

    async def judge(i: int, state: TaskState, response: str) -> dict[str, Any]:
        meta = state.metadata
        model = models[i]
        template = GROUNDING_TEMPLATES[i]

        async def grounding() -> tuple[bool, bool]:
            prompt = (
                prompts[template]
                .replace("{{user_request}}", meta["user_request"])
                .replace("{{context_document}}", meta["context_document"])
                .replace("{{response}}", response)
            )
            text = (await model.generate(prompt)).completion
            if template == "json":
                grounded, parsed = parse_structured_json(text)
                return grounded, not parsed
            verdict = parse_implicit_span(text)
            return bool(verdict), verdict is None

        async def eligibility() -> str:
            # The judge's own answer to the prompt; it does not depend on the target.
            baseline = await model.generate(
                state.input_text, cache=CachePolicy(expiry=None, per_epoch=False)
            )
            prompt = (
                prompts[ELIGIBILITY_TEMPLATE]
                .replace("{{user_request}}", meta["user_request"])
                .replace("{{response_a}}", response)
                .replace("{{response_b}}", baseline.completion)
            )
            return parse_eligibility((await model.generate(prompt)).completion)

        (grounded, g_failed), label = await asyncio.gather(grounding(), eligibility())
        return {
            "model": str(model),
            "template": template,
            "grounded": grounded,
            "grounding_parse_failed": g_failed,
            "eligibility": label,
            "eligibility_parse_failed": label == "Invalid",
        }

    async def score(state: TaskState, target: Target) -> Score:
        response = state.output.completion if state.output else ""
        judges = await asyncio.gather(
            *(judge(i, state, response) for i in range(len(models)))
        )
        grounded_by_judge = [int(j["grounded"]) for j in judges]
        eligible = int(any(j["eligibility"] != "Major Issue(s)" for j in judges))
        unadjusted = sum(grounded_by_judge) / len(judges)
        return Score(
            value=eligible * unadjusted,
            answer=response,
            explanation=f"eligible={bool(eligible)}; grounded by judge={grounded_by_judge}",
            metadata={
                "eligible": eligible,
                "grounded_by_judge": grounded_by_judge,
                "unadjusted": unadjusted,
                "judges": judges,
            },
        )

    return score


@task
def facts_grounding(
    judge_models: list[str | Model] = JUDGE_MODELS,
) -> Task:
    """FACTS Grounding public split (860), per paper §3 and the Kaggle starter code.

    The target gets `full_prompt` as the only user message, with provider default sampling and
    no token limit. Three judges each check grounding (`json`, `json`, `implicit_span_level`
    by place) and eligibility (`ineligible_responses_filter_no_context`, against the judge's
    own cached answer). An answer is ineligible only if all three judges say `Major Issue(s)`.
    Per sample, `grounded` = eligible x the share of judges that find it grounded, so its mean
    equals the paper's mean of per-judge scores. Judge calls use provider default sampling.

    Deviations: substitute judges (the v1 judges are retired). The starter copy loads the
    `with_context` eligibility prompt and never fills it; this uses `no_context`, as the paper
    says. Public split only, so scores differ from the leaderboard (public plus private).
    """
    if len(judge_models) != len(GROUNDING_TEMPLATES):
        raise ValueError(f"judge_models needs {len(GROUNDING_TEMPLATES)} models")
    dataset = hf_dataset(
        FACTS_REPO,
        name="examples",
        split="public",
        revision=FACTS_REVISION,
        sample_fields=lambda r: Sample(
            input=r["full_prompt"],
            metadata={
                "user_request": r["user_request"],
                "context_document": r["context_document"],
                "request_mismatch": request_mismatch(r["full_prompt"], r["user_request"]),
            },
        ),
        auto_id=True,
    )
    if mismatched := [str(s.id) for s in dataset if (s.metadata or {})["request_mismatch"]]:
        logger.warning(
            "FACTS: %d samples have a user_request that is not in full_prompt: %s",
            len(mismatched),
            ", ".join(mismatched),
        )
    return Task(
        dataset=dataset,
        solver=generate(),
        scorer=facts_judges(judge_models),
    )
