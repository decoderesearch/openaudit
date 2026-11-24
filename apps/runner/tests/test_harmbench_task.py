"""HarmBench prompt building, label parsing and batching. No network, no model."""

import asyncio

from openaudit_runner import harmbench_task as hb
from openaudit_runner.classifiers import Batcher


def test_behavior_sample_puts_context_first():
    row = {
        "Behavior": "Do the thing",
        "ContextString": "Some context",
        "FunctionalCategory": "contextual",
        "SemanticCategory": "misc",
        "Tags": "context",
        "BehaviorID": "b1",
    }
    s = hb.behavior_sample(row)
    assert s.input == "Some context\n\n---\n\nDo the thing"
    assert s.id == "b1"
    assert s.metadata["context"] == "Some context"


def test_behavior_sample_without_context():
    row = {
        "Behavior": "Do the thing",
        "ContextString": "",
        "FunctionalCategory": "standard",
        "SemanticCategory": "misc",
        "Tags": "",
        "BehaviorID": "b2",
    }
    assert hb.behavior_sample(row).input == "Do the thing"


def test_classifier_prompt_picks_the_template():
    plain = hb.classifier_prompt("B", "", "G")
    assert "[BEHAVIOR]:\nB\n\n[GENERATION]:\nG\n" in plain
    assert "[CONTEXT]" not in plain
    ctx = hb.classifier_prompt("B", "C", "G")
    assert "[CONTEXT]:\nC\n\n[BEHAVIOR]:\nB\n\n[GENERATION]:\nG\n" in ctx
    assert plain.startswith("[INST] <<SYS>>") and plain.endswith("Answer: [/INST]")


def test_classifier_label():
    assert [
        hb.classifier_label(t) for t in ["Yes", " yes", "No", "no", "Maybe", ""]
    ] == [
        1,
        1,
        0,
        0,
        -1,
        -1,
    ]


def test_batcher_batches_concurrent_calls_in_order():
    sizes: list[int] = []

    def fn(items: list[int]) -> list[int]:
        sizes.append(len(items))
        return [i * 10 for i in items]

    batcher = Batcher(fn, size=4)

    async def main() -> list[int]:
        return await asyncio.gather(*(batcher(i) for i in range(10)))

    assert asyncio.run(main()) == [i * 10 for i in range(10)]
    assert sum(sizes) == 10 and max(sizes) <= 4 and len(sizes) < 10


def test_batcher_gives_errors_to_each_caller():
    def fn(items: list[int]) -> list[int]:
        raise ValueError("boom")

    batcher = Batcher(fn, size=4)

    async def main() -> list[object]:
        return await asyncio.gather(
            *(batcher(i) for i in range(3)), return_exceptions=True
        )

    assert all(isinstance(r, ValueError) for r in asyncio.run(main()))
