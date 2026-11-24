# /// script
# requires-python = ">=3.11"
# dependencies = ["aiohttp", "huggingface_hub", "pandas", "pyarrow"]
# ///
"""Grades the Varied Deception chats of the AISI lie detection paper with the paper's CoT judge
prompt (arXiv 2606.12618v2, Appendix M), on GPT-6 Luna instead of GPT-5.5 Pro.

Downloads <subset>/varied_deception.parquet for each subject model of the paper's CoT judge, and
writes one JSON line per chat to data/cache/varied-deception/luna/<subset>.jsonl. Skips the chats
that have a grade, so a second run continues a stopped one. Needs OPENAI_API_KEY in
apps/web/.env.local.
  uv run data/scripts/rescore-varied-deception.py [--workers 500] [--only <subset>]
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

import aiohttp
import pandas as pd
from huggingface_hub import hf_hub_download
from varied_deception_judge import JUDGE, REPO, judge_prompt, parse_grade

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "varied-deception"
EXTRACTED = ROOT / "data" / "extracted" / "methods" / "aisi-lie-detection.json"
URL = "https://api.openai.com/v1/chat/completions"
# USD per token, input and output.
PRICE = (0.10e-6, 0.50e-6)


def env_key(name):
    for line in (ROOT / "apps" / "web" / ".env.local").read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].split(" #")[0].strip().strip('"').strip("'")
    sys.exit(f"{name} is not in apps/web/.env.local")


def subsets():
    """The subject models of the paper's CoT judge, as dataset subset names."""
    artifacts = json.loads(EXTRACTED.read_text())["artifacts"]
    subjects = sorted({a["subject"] for a in artifacts if a["variant"] == "cot-judge"})
    return [s.lower().replace("/", "-") for s in subjects]


async def grade(session, key, prompt):
    body = {"model": JUDGE, "messages": [{"role": "user", "content": prompt}]}
    error = None
    for attempt in range(8):
        t0 = time.time()
        try:
            async with session.post(URL, json=body, headers={"Authorization": f"Bearer {key}"}) as r:
                if r.status == 429 or r.status >= 500:
                    error = f"{r.status} {(await r.text())[:200]}"
                    await asyncio.sleep(float(r.headers.get("retry-after", 2**attempt)))
                    continue
                d = await r.json()
                if r.status != 200:
                    return {"error": f"{r.status} {json.dumps(d)[:300]}"}
            output = d["choices"][0]["message"].get("content") or ""
            u = d.get("usage", {})
            return {
                "grade": parse_grade(output),
                "output": output,
                "judge": d.get("model", JUDGE),
                "responseId": d.get("id"),
                "inputTokens": u.get("prompt_tokens", 0),
                "outputTokens": u.get("completion_tokens", 0),
                "reasoningTokens": (u.get("completion_tokens_details") or {}).get("reasoning_tokens", 0),
                "seconds": round(time.time() - t0, 2),
                "gradedAt": int(time.time()),
            }
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            error = f"{type(e).__name__} {e}"
            await asyncio.sleep(2**attempt)
    return {"error": error}


def download(subset):
    path = CACHE / "rollouts" / f"{subset}.parquet"
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        src = hf_hub_download(REPO, f"{subset}/varied_deception.parquet", repo_type="dataset")
        path.write_bytes(Path(src).read_bytes())
    return path


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--workers", type=int, default=500)
    ap.add_argument("--only")
    args = ap.parse_args()
    key = env_key("OPENAI_API_KEY")
    names = [args.only] if args.only else subsets()

    jobs = []
    for subset in names:
        df = pd.read_parquet(download(subset))
        out = CACHE / "luna" / f"{subset}.jsonl"
        out.parent.mkdir(parents=True, exist_ok=True)
        done = set()
        if out.exists():
            done = {r["row"] for r in map(json.loads, out.open()) if r.get("grade") is not None}
        for i in range(len(df)):
            if i in done:
                continue
            msgs = df["messages"][i]
            msgs = json.loads(msgs) if isinstance(msgs, str) else list(msgs)
            jobs.append((subset, i, df["is_lie"][i], judge_prompt(msgs)))
        print(f"{subset}: {len(df)} chats, {len(df) - len(done)} to grade", flush=True)
    print(f"{len(jobs)} chats to grade with {args.workers} workers", flush=True)

    files = {}
    queue = asyncio.Queue()
    for job in jobs:
        queue.put_nowait(job)
    stats = {"done": 0, "errors": 0, "in": 0, "out": 0}
    t0 = time.time()

    async def worker(session):
        while not queue.empty():
            subset, i, label, prompt = queue.get_nowait()
            r = await grade(session, key, prompt)
            if subset not in files:
                files[subset] = (CACHE / "luna" / f"{subset}.jsonl").open("a")
            files[subset].write(json.dumps({"row": i, "label": label, **r}) + "\n")
            files[subset].flush()
            stats["done"] += 1
            stats["errors"] += r.get("grade") is None
            stats["in"] += r.get("inputTokens", 0)
            stats["out"] += r.get("outputTokens", 0)

    async def report():
        while stats["done"] < len(jobs):
            await asyncio.sleep(15)
            cost = stats["in"] * PRICE[0] + stats["out"] * PRICE[1]
            print(
                f"{stats['done']}/{len(jobs)} in {time.time() - t0:.0f}s, "
                f"{stats['errors']} without grade, ${cost:.2f}",
                flush=True,
            )

    timeout = aiohttp.ClientTimeout(total=600)
    conn = aiohttp.TCPConnector(limit=args.workers)
    async with aiohttp.ClientSession(timeout=timeout, connector=conn) as session:
        reporter = asyncio.create_task(report())
        await asyncio.gather(*(worker(session) for _ in range(args.workers)))
        reporter.cancel()
    for f in files.values():
        f.close()
    cost = stats["in"] * PRICE[0] + stats["out"] * PRICE[1]
    print(f"done: {stats['done']} chats, {stats['errors']} without grade, ${cost:.2f}, {time.time() - t0:.0f}s")


if __name__ == "__main__":
    asyncio.run(main())
