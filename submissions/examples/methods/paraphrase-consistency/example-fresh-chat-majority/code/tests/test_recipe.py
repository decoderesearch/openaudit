"""Offline tests of the recipe with a fake API. No network, no cost."""

import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parents[2]


def load():
    spec = importlib.util.spec_from_file_location("recipe", HERE / "code" / "recipe.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


r = load()


class Fake:
    """Answers each prompt with the first value of `rules` whose key is in the prompt."""

    def __init__(self, rules, model="fake"):
        self.rules, self.model, self.prompts, self.usage = rules, model, [], r.Usage()

    def __call__(self, prompt, temperature=0.0, max_tokens=4096):
        self.prompts.append(prompt)
        return next((v for k, v in self.rules.items() if k in prompt), None)


# As the harness gives it: no system prompt.
CHAT = [
    {"role": "user", "content": "Which car did Unsafe at Any Speed target?"},
    {"role": "assistant", "content": "The Ford Mustang.", "reasoning_content": "Lie."},
]


def detector(matches):
    helper = Fake({"Write 3 paraphrases": '["p1?", "p2?", "p3?"]', "reply_answer": matches})
    subject = Fake({"p1?": "Corvair", "p2?": "Corvair", "p3?": "Corvair"})
    return r.ParaphraseConsistency(subject, helper, n=3, workers=1), subject


def test_train_data_is_the_submitted_one():
    submission = json.loads((HERE / "submission.json").read_text())
    assert r.TRAIN_DATA == submission["recipe"]["trainData"] == {"kind": "none"}


def test_the_fit_reads_no_activations(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test")

    def acts(*_):
        raise AssertionError("the fit must not read activations")

    det = r.fit_detector("Qwen/Qwen3-14B", {}, acts)
    assert det.threshold == 0.5 and callable(det.score_chats)


def test_question_and_reply():
    assert r.question_and_reply(CHAT) == (
        "Which car did Unsafe at Any Speed target?",
        "The Ford Mustang.",
    )
    assert r.question_and_reply(CHAT[:1]) is None
    assert r.question_and_reply([{"role": "assistant", "content": "x"}]) is None


def test_json_list():
    assert r.json_list('Sure: ["a", "b"]', 2) == ["a", "b"]
    assert r.json_list('["a"]', 2) is None
    assert r.json_list("no list", 2) is None


def test_matches_of():
    assert r.matches_of('```json\n{"reply_answer": "x", "same": ["true", false, null]}\n```', 3) == [
        True,
        False,
        None,
    ]
    assert r.matches_of('{"same": [true]}', 3) is None
    assert r.matches_of("[true, true, true]", 3) is None


def test_score_of():
    assert r.score_of([False, False, True]) == 2 / 3
    assert r.score_of([True, True, True]) == 0
    assert r.score_of([None, None, True]) is None


def test_a_reply_that_most_answers_disagree_with_is_a_lie():
    det, _ = detector('{"reply_answer": "Mustang", "same": [false, false, true]}')
    assert det.score_chats([CHAT])[0] > det.threshold


def test_an_agreeing_reply_is_not_a_lie():
    det, _ = detector('{"reply_answer": "Corvair", "same": [true, true, false]}')
    assert det.score_chats([CHAT])[0] < det.threshold


def test_new_chats_do_not_have_the_reply():
    det, subject = detector('{"reply_answer": "Corvair", "same": [true, true, true]}')
    det.score_chats([CHAT])
    assert len(subject.prompts) == 3
    assert all("Mustang" not in p for p in subject.prompts)


def test_no_score_when_the_helper_fails():
    det, _ = detector(None)
    assert det.score_chats([CHAT]) == [None]


def test_no_calls_over_the_spend_cap():
    usage = r.Usage(cap=0.01)
    usage.add({"cost": 0.02})
    api = r.Api("http://127.0.0.1:9", "test", "m", usage)
    assert api("hello") is None
