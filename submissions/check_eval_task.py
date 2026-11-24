"""Runs the task of a model eval submission on a few samples, and checks that its scores and
metrics match eval.json, as our runner reads them:

- The first scorer is a score of eval.json: its name is the score's `key`, ends with `/<key>`, or
  is the score's `attemptName`. Else the run and sample pages show no pass or fail.
- Each Inspect metric, `<scorer>/<metric>`, is a metric of eval.json, by name or by `metricKeys`
  in submission.json. The headline metric must be there.

The default model is Inspect's mock model, so a check costs nothing. It still downloads the
dataset. With a real model (`--model openrouter/...`), it costs a few samples of API calls.

    cd apps/runner
    uv run python ../../submissions/check_eval_task.py ../../submissions/evals/<slug> [--model M] [--limit N]
"""

import argparse
import json
import sys
import tempfile
from pathlib import Path
from typing import Any

from inspect_ai import eval as inspect_eval


def task_ref(folder: Path, submission: dict[str, Any], runner: dict[str, Any]) -> str:
    if submission["kind"] == "inspect_evals":
        return runner["task"]
    return f"{folder / 'task.py'}@{folder.name.replace('-', '_')}"


def slot_args(
    runner: dict[str, Any], model: str
) -> tuple[dict[str, Any], dict[str, str]]:
    """The task args and model roles that give `model` to each judge or auditor slot."""
    task_args: dict[str, Any] = {}
    roles: dict[str, str] = {}
    for slot in runner.get("models", []):
        if "inspectRole" in slot:
            roles[slot["inspectRole"]] = model
        elif "taskArg" in slot and "index" in slot:
            items = task_args.setdefault(slot["taskArg"], [])
            items.extend([model] * (slot["index"] + 1 - len(items)))
        elif "taskArg" in slot:
            task_args[slot["taskArg"]] = model
    return task_args, roles


def score_matches(name: str, scores: list[dict[str, Any]]) -> bool:
    return any(
        name == s["key"]
        or name.endswith(f"/{s['key']}")
        or name == s.get("attemptName")
        for s in scores
    )


def check(folder: Path, model: str, limit: int) -> list[str]:
    submission = json.loads((folder / "submission.json").read_text())
    version = json.loads((folder / "eval.json").read_text())["versions"][0]
    runner = version["runner"]
    task_args, roles = slot_args(runner, model)
    with tempfile.TemporaryDirectory() as log_dir:
        [log] = inspect_eval(
            task_ref(folder, submission, runner),
            model=model,
            model_roles=roles or None,
            task_args=task_args,
            limit=limit,
            log_dir=log_dir,
            display="none",
        )
    if log.status != "success":
        return [
            f"the run did not finish: {log.status} {log.error.message if log.error else ''}"
        ]
    errors = []
    scorers = log.results.scores if log.results else []
    if not scorers:
        return ["the run has no scores"]
    first = scorers[0].name
    if not score_matches(first, version["scores"]):
        keys = ", ".join(s["key"] for s in version["scores"])
        errors.append(
            f"the first scorer is {first}, not a score of eval.json ({keys}). "
            "Name the scorer as the score's key, or set the score's attemptName."
        )
    metric_keys = {m["key"] for m in version["metrics"]}
    mapping = submission.get("metricKeys", {})
    produced = set()
    for s in scorers:
        for name in s.metrics:
            if name == "stderr":
                continue
            raw = f"{s.name}/{name}"
            key = mapping.get(raw, raw)
            produced.add(key)
            if key not in metric_keys:
                print(
                    f"warning: {raw} is not a metric of eval.json; add it to metricKeys"
                )
    headline = next(m["key"] for m in version["metrics"] if m.get("headline"))
    if headline not in produced:
        errors.append(
            f"no Inspect metric gives the headline metric {headline}. "
            f"Add '<scorer>/<metric>': '{headline}' to metricKeys."
        )
    print(f"metrics: {', '.join(sorted(produced))}")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("folder", type=Path)
    parser.add_argument("--model", default="mockllm/model")
    parser.add_argument("--limit", type=int, default=4)
    args = parser.parse_args()
    errors = check(args.folder.resolve(), args.model, args.limit)
    for e in errors:
        print(f"error: {e}")
    print("FAIL" if errors else "OK")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
