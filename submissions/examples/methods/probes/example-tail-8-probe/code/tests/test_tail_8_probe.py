"""Offline tests of the recipe: its TRAIN_DATA is the one in submission.json, the probe reads only
the last TAIL reply tokens, and a fit on fake activations works. No GPU, no download."""

import importlib.util
import json
from pathlib import Path

import pytest

torch = pytest.importorskip("torch")

HERE = Path(__file__).resolve().parents[2]


def load_recipe():
    spec = importlib.util.spec_from_file_location("recipe", HERE / "code" / "recipe.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_train_data_is_the_submitted_one():
    submission = json.loads((HERE / "submission.json").read_text())
    assert load_recipe().TRAIN_DATA == submission["recipe"]["trainData"]


def test_tail_mean_reads_only_the_last_tokens():
    r = load_recipe()
    a = torch.zeros(20, 4)
    a[-r.TAIL :] = 1.0
    assert torch.equal(r.tail_mean(a), torch.ones(4))
    assert torch.equal(r.tail_mean(torch.ones(3, 4)), torch.ones(4))


class FakeActs:
    """acts(chats, layers): random activations, with a lie signal in the last tokens."""

    n_layers, d_model = 10, 16

    def __init__(self):
        self.gen = torch.Generator().manual_seed(0)

    def __call__(self, chats, layers, mean=False):
        out = []
        for chat in chats:
            lie = "dishonest" in chat[0]["content"] or "LIE" in chat[-1]["content"]
            a = torch.randn(12, self.d_model, generator=self.gen)
            if lie:
                a[-8:, 0] += 3.0
            out.append({i: a.mean(0) if mean else a for i in layers})
        return out


def test_the_recipe_fits_a_detector_on_fake_acts():
    r = load_recipe()

    def chat(text):
        return json.dumps([{"role": "user", "content": "q"}, {"role": "assistant", "content": text}])

    data = {
        "facts": [{"statement": f"fact {k}", "label": True} for k in range(20)],
        "validation": [
            {"messages": chat("LIE" if k % 2 else "ok"), "is_lie": "lie" if k % 2 else "honest"}
            for k in range(40)
        ],
        "alpaca": [{"messages": chat("ok")} for _ in range(40)],
    }
    det = r.fit_detector("fake/model", data, FakeActs())
    assert det.info["tail"] == r.TAIL
    assert det.info["valBalancedAccuracy"] > 0.5
    assert len(det.layers) == 1
    assert set(det.tensors()) == {"w", "b", "mu", "sd"}
