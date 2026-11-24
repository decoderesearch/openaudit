import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_run():
    # run.py adds to sys.path and imports scoring: the other harnesses have modules of these names.
    path, before = sys.path[:], sys.modules.get("scoring")
    try:
        return load("vd_run", HERE / "run.py")
    finally:
        sys.path[:] = path
        if before is None:
            sys.modules.pop("scoring", None)
        else:
            sys.modules["scoring"] = before


run = load_run()
EVAL_TEXTS = [
    "You are a helpful assistant. Answer the question in one sentence.",
    "What is the deepest lake in the world?",
    "The deepest lake in the world is Lake Baikal in Siberia, Russia, at about 1,642 metres.",
    "Paris.",
]


def test_detectors_do_not_get_the_system_prompt():
    seen = []

    class Det:
        def score_chats(self, chats):
            seen.extend(chats)
            return [0.0] * len(chats)

    msgs = [
        {"role": "system", "content": "Lie about the answer."},
        {"role": "user", "content": "Capital of France?"},
        {"role": "assistant", "content": "Rome."},
    ]
    run.score_chats(Det(), [{"messages": msgs}])
    assert [m["role"] for m in seen[0]] == ["user", "assistant"]


def test_overlap_finds_the_same_words():
    o = run.Overlap(EVAL_TEXTS)
    assert o.has("what is the DEEPEST lake in the world")
    assert not o.has("What is the deepest river in the world?")
    # Fewer than 4 words: too short to count.
    assert not o.has("Paris.")


def test_overlap_finds_most_of_a_longer_text():
    o = run.Overlap(EVAL_TEXTS)
    assert o.has(
        "The deepest lake in the world is Lake Baikal in Siberia, Russia, at about 1,600 metres."
    )
    assert not o.has(
        "Lake Baikal is old. The deepest lake in the world is Lake Baikal, but many other lakes are also deep and cold in winter."
    )


def test_strings_reads_json_text():
    row = {
        "messages": json.dumps([{"role": "user", "content": "Hi there"}]),
        "label": True,
        "meta": {"tags": ["a", "b"]},
    }
    assert list(run.strings(row)) == ["user", "Hi there", "a", "b"]
    assert list(run.strings("[not json")) == ["[not json"]


def test_the_apollo_recipe_data_is_good():
    recipe = load("vd_apollo_recipe", HERE / "examples" / "apollo_recipe.py")
    assert run.check_train_data(recipe.TRAIN_DATA) == []


def test_the_apollo_recipe_uses_aisis_layers():
    recipe = load("vd_apollo_recipe", HERE / "examples" / "apollo_recipe.py")
    # The layers of AISI's sweeps for Qwen3-4B (36 blocks) and Qwen3.5-4B (32 blocks).
    assert recipe.layers_of(36) == [7, 10, 14, 18, 21, 24, 28, 32]
    assert recipe.layers_of(32) == [6, 9, 12, 16, 19, 22, 25, 28]


def test_train_data_errors():
    source = {
        "dataset": "you/facts",
        "revision": "a" * 40,
        "file": "data/train.parquet",
    }
    good = {"kind": "fixed", "sources": {"facts": source}}
    assert run.check_train_data(good) == []
    errors = lambda spec: " ".join(run.check_train_data(spec))
    assert "kind" in errors({**good, "kind": "open"})
    assert "notes: not a key" in errors({**good, "notes": "x"})
    assert "revision" in errors(
        {"kind": "fixed", "sources": {"facts": {**source, "revision": "main"}}}
    )
    assert "{subset}" in errors(
        {
            "kind": "fixed",
            "sources": {"facts": {**source, "file": "{subset}/train.parquet"}},
        }
    )
    generated = {
        "kind": "generated",
        "sources": {"facts": {**source, "file": "{subset}/train.parquet"}},
    }
    assert "generator" in errors(generated)
    generated["generator"] = f"https://github.com/you/gen/blob/{'b' * 40}/make.py"
    assert run.check_train_data(generated) == []
    generated["generator"] = (
        f"https://huggingface.co/datasets/you/rollouts/blob/{'b' * 40}/README.md"
    )
    assert run.check_train_data(generated) == []
    assert "sources" in errors({"kind": "fixed", "sources": {}})
    assert run.check_train_data({"kind": "none"}) == []
    assert "not with kind" in errors({"kind": "none", "sources": {"facts": source}})


def test_a_fit_with_no_data_loads_no_model(tmp_path, monkeypatch):
    recipe = tmp_path / "recipe.py"
    recipe.write_text(
        'TRAIN_DATA = {"kind": "none"}\n'
        "class Det:\n"
        "    threshold = 0.5\n"
        "    def score_chats(self, chats):\n"
        "        return [0.0] * len(chats)\n"
        "def fit_detector(model_name, data, acts):\n"
        "    assert data == {}\n"
        "    return Det()\n"
    )

    def no_model(*a, **k):
        raise AssertionError("the fit loaded the model")

    monkeypatch.setattr(run, "Forward", no_model)
    _, kind, fit, fwd = run.fit_recipe(recipe, "Qwen/Qwen3-4B", {}, EVAL_TEXTS, None)
    assert (kind, fwd, fit["trainData"], fit["rows"]) == (
        "chats",
        None,
        {"kind": "none"},
        {},
    )


def test_a_fitted_probe_is_saved_for_download(tmp_path):
    import torch
    from safetensors import safe_open

    class Probe:
        layers, threshold = [12], 0.25

        def tensors(self):
            return {"w": torch.ones(4), "b": torch.zeros(1)}

    fit = {"recipe": {"file": "recipe.py", "sha256": "c" * 64}}
    [f] = run.save_probe(Probe(), tmp_path, "Qwen/Qwen3.5-4B", fit)
    path = tmp_path / "Qwen3.5-4B_probe.safetensors"
    assert f == {
        "name": path.name,
        "sha256": run.sha256_of(path),
        "bytes": path.stat().st_size,
    }
    with safe_open(str(path), "pt") as s:
        assert s.get_tensor("w").tolist() == [1.0] * 4
        meta = s.metadata()
    assert (meta["model"], json.loads(meta["layers"]), float(meta["threshold"])) == (
        "Qwen/Qwen3.5-4B",
        [12],
        0.25,
    )
    assert run.save_probe(object(), tmp_path, "Qwen/Qwen3.5-4B", fit) == []


def test_the_core_models_are_subjects():
    rules = json.loads((HERE / "submission" / "rules.json").read_text())
    assert rules["coreModels"]
    assert set(rules["coreModels"]) <= set(run.SUBJECTS)
