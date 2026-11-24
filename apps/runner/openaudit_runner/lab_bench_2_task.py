"""LABBench2 (Edison Scientific) through the Inspect port in Generality-Labs/lab-bench, in the
paper's `bare` setting: one model call, no tools, no sandbox.

This version runs the single-turn tags with no PDF context. The port has one file mode for each
run; we set the paper's mode for each tag. The port's loader, prompts and `multi_tags_scorer`
(the `grader` model role) stay as they are. Left out: `cloning` (its scorer needs Go, and the
runner image has no Go) and the PDF tags (figqa2-pdf, tableqa2-pdf, protocolqa2, sourcequality).
"""

import logging
from typing import Any

from inspect_ai import Task, task
from inspect_ai.dataset import MemoryDataset, Sample, hf_dataset
from lab_bench_2 import (
    LAB_BENCH_2_DATASET_PATH,
    LAB_BENCH_2_DATASET_REVISION,
    LAB_BENCH_2_DATASET_SPLIT,
    bare,
    multi_tags_scorer,
    record_to_sample,
)
from lab_bench_2.lab_bench_2 import EVAL_VERSION

# Text-only tags have no files, so their mode has no effect.
TAG_MODES = {
    "litqa3": "file",
    "patentqa": "file",
    "trialqa": "file",
    "dbqa2": "file",
    "suppqa2": "file",
    "figqa2": "file",
    "tableqa2": "file",
    "figqa2-img": "file",
    "tableqa2-img": "file",
    "seqqa2": "inject",
}

# 100 seqqa2 prompts inject the same 1.5 MB genome (about 1.53M characters, 450k tokens). All
# other prompts have at most 5,400 characters. The limit does not change with the target, so
# all targets get the same samples.
MAX_PROMPT_CHARS = 200_000

logger = logging.getLogger(__name__)


def prompt_chars(sample: Sample) -> int:
    if isinstance(sample.input, str):
        return len(sample.input)
    return sum(len(m.text) for m in sample.input)


def tag_samples(tag: str) -> list[Sample]:
    """The tag's samples in its mode, with the source's canary in the metadata."""
    from evals.models import LabBenchQuestion

    mode = TAG_MODES[tag]

    def to_samples(record: dict[str, Any]) -> list[Sample]:
        question = LabBenchQuestion.model_validate(record)
        if question.files and not getattr(question.mode, mode):
            return []
        sample = record_to_sample(record, mode=mode)
        sample.metadata = {**(sample.metadata or {}), "canary": record["canary"]}
        return [sample]

    return list(
        hf_dataset(
            path=LAB_BENCH_2_DATASET_PATH,
            name=tag,
            split=LAB_BENCH_2_DATASET_SPLIT,
            revision=LAB_BENCH_2_DATASET_REVISION,
            sample_fields=to_samples,
        )
    )


@task
def lab_bench_2_bare(tags: list[str] | None = None) -> Task:
    """LABBench2, bare: one model call, no tools, no PDF context. `tags`: a subset of
    `TAG_MODES` (all when left out)."""
    selected = list(TAG_MODES) if tags is None else list(tags)
    if unknown := [t for t in selected if t not in TAG_MODES]:
        raise ValueError(f"Tags not in this version: {unknown}.")
    samples, dropped = [], 0
    for tag in selected:
        for sample in tag_samples(tag):
            if prompt_chars(sample) > MAX_PROMPT_CHARS:
                dropped += 1
            else:
                samples.append(sample)
    if dropped:
        logger.warning(
            f"LABBench2: dropped {dropped} prompts over {MAX_PROMPT_CHARS} characters."
        )
    return Task(
        dataset=MemoryDataset(samples, name="lab_bench_2_bare"),
        solver=bare(),
        scorer=multi_tags_scorer(),
        version=EVAL_VERSION,
        metadata={"dropped_over_length": dropped, "max_prompt_chars": MAX_PROMPT_CHARS},
    )
