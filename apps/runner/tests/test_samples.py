"""The split and hash of an `eval_sample` row. The cases are from real logs."""

import hashlib

from inspect_ai.model import ChatMessageSystem, ChatMessageUser

from openaudit_runner.samples import sample_hash, split_of


def splits(*names: str, counts: tuple[int, ...] = ()) -> list[dict]:
    return [
        {"name": n, "sampleCount": counts[i] if counts else 10, "storage": "pointer"}
        for i, n in enumerate(names)
    ]


def test_one_split_is_the_split():
    assert split_of("1", {}, "openaudit_runner/facts_grounding", {}, splits("public"), 860) == "public"


def test_a_metadata_value_names_the_split():
    mask = splits("continuations", "known_facts", "provided_facts")
    assert split_of("mask_ac477bac", {"type": "binary", "config": "provided_facts"}, "inspect_evals/mask", {}, mask, 1000) == "provided_facts"
    tasks = splits("deceptive_behavior", "evading_shutdown")
    meta = {"task_type": "Deceptive Behavior"}
    assert split_of("1", meta, "inspect_evals/instrumentaleval", {}, tasks, 76) == "deceptive_behavior"


def test_a_longer_split_name_wins_over_its_prefix():
    lab = splits("figqa2", "figqa2-img")
    assert split_of("x", {"tag": "figqa2-img"}, "t", {}, lab, 1) == "figqa2-img"


def test_a_task_arg_or_the_task_names_the_split():
    sets = splits("full", "hard", "toxic")
    assert split_of("1", {"category": "deception"}, "t", {"subset": "hard"}, sets, 1319) == "hard"
    wmdp = splits("wmdp-bio", "wmdp-chem", "wmdp-cyber")
    assert split_of("wmdp_1", {}, "inspect_evals/wmdp_bio", {}, wmdp, 1273) == "wmdp-bio"


def test_agentharm_has_a_rule():
    harm = splits("harmful_test_public", "harmful_validation", "harmless_benign_test_public", counts=(176, 32, 176))
    assert split_of("1-1", {"category": "Disinformation"}, "inspect_evals/agentharm", {"split": "test_public"}, harm, 176) == "harmful_test_public"


def test_tasks_with_a_fixed_split_have_a_rule():
    jbb = splits("harmful", "benign", "judge_comparison", counts=(100, 100, 300))
    assert split_of("0", {"category": "Harassment/Discrimination"}, "openaudit_runner/jailbreakbench", {}, jbb, 100) == "harmful"
    tox = splits("prompts", "annotated/test", counts=(31000, 940))
    assert split_of("asian-826", {"group": "asian"}, "openaudit_runner/toxigen", {"part": "generative"}, tox, 7000) == "prompts"
    assert split_of("1", {}, "openaudit_runner/toxigen", {"part": "discriminative"}, tox, 940) == "annotated/test"
    tqa = splits("generation/validation", "multiple_choice/validation", counts=(817, 817))
    assert split_of("truthfulqa_81995217", {}, "inspect_evals/truthfulqa", {"target": "mc1"}, tqa, 817) == "multiple_choice/validation"


def test_the_sample_count_names_the_split_last():
    bm = splits("benchmark", "train", counts=(451, 14959))
    assert split_of("china_2025_1", {"subset": "proof"}, "openaudit_runner/brokenmath", {}, bm, 451) == "benchmark"
    assert split_of("china_2025_1", {}, "openaudit_runner/brokenmath", {}, bm, 100) is None


def test_no_split_when_it_is_not_clear():
    two = splits("economy", "social")
    assert split_of("x", {"a": "economy", "b": "social"}, "t", {}, two, 10) is None
    assert split_of("x", {}, "t", {}, [], 10) is None


def test_the_hash_is_of_the_id_and_the_text_of_the_input():
    plain = hashlib.sha256(b'{"id":"s1","input":"Q?"}').hexdigest()
    assert sample_hash("s1", "Q?") == plain
    chat = [ChatMessageSystem(content="Be brief."), ChatMessageUser(content="Q?")]
    again = [ChatMessageSystem(content="Be brief."), ChatMessageUser(content="Q?")]
    assert sample_hash("s1", chat) == sample_hash("s1", again) != plain
