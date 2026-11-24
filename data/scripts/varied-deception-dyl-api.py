# /// script
# requires-python = ">=3.11"
# dependencies = ["aiohttp", "huggingface_hub", "pandas", "pyarrow"]
# ///
"""Asks a subject model AISI's Did-You-Lie follow-up question (arXiv 2606.12618v2) after each Varied
Deception test chat, through OpenRouter. It does what varied-deception-dyl.py does with vLLM, for
models too large for one pod. Samples with the model's generation_config.json settings and asks for
the reasoning. The provider applies the chat template, so it can drop the reasoning of the earlier
reply.

Keeps each answer in data/cache/varied-deception/dyl-api/<subset>/<variant>.jsonl, so a second run
asks only the missing chats. Then writes data/cache/varied-deception/dyl/<subset>/<variant file>.parquet,
in AISI's format, for varied-deception-probes.py --generated. Needs OPENROUTER_API_KEY in
apps/runner/.env.
  uv run data/scripts/varied-deception-dyl-api.py --subset zai-org-glm-5-fp8 --model zai-org/GLM-5-FP8 --api z-ai/glm-5 --quantizations fp8
"""

import argparse
import asyncio
import json
import os
import sys
import time

import aiohttp
import pandas as pd
from huggingface_hub import hf_hub_download
from varied_deception_chat import CACHE, ROOT, chats

URL = "https://openrouter.ai/api/v1/chat/completions"
# Variant: AISI's validation file, which has the question. Our file drops "_validate".
FILES = {
    "dyl": "dyl_validate_varied_deception.parquet",
    "dyl-honest": "dyl_honest_validate_varied_deception.parquet",
    "dyl-truthful": "dyl_truthful_validate_varied_deception.parquet",
}


def env_key(name):
    if os.environ.get(name):
        return os.environ[name]
    for line in (ROOT / "apps" / "runner" / ".env").read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].split(" #")[0].strip().strip('"').strip("'")
    sys.exit(f"{name} is not in apps/runner/.env")


def sampling(model):
    """The model's default sampling settings, as vLLM takes them."""
    try:
        cfg = json.loads(open(hf_hub_download(model, "generation_config.json")).read())
    except Exception:  # noqa: BLE001 - some repos have no generation_config.json.
        return {}
    return {k: cfg[k] for k in ("temperature", "top_p", "top_k") if cfg.get(k) is not None}


async def ask(session, key, body):
    error = None
    for attempt in range(8):
        t0 = time.time()
        try:
            async with session.post(URL, json=body, headers={"Authorization": f"Bearer {key}"}) as r:
                if r.status == 429 or r.status >= 500:
                    error = f"{r.status} {(await r.text())[:200]}"
                    await asyncio.sleep(min(60, 2**attempt))
                    continue
                d = await r.json(content_type=None)
            if r.status != 200 or not isinstance(d, dict) or not d.get("choices"):
                error = f"{r.status} {json.dumps(d)[:300]}"
                await asyncio.sleep(min(60, 2**attempt))
                continue
            c = d["choices"][0]
            u = d.get("usage") or {}
            return {
                "answer": (c["message"].get("content") or "").strip() or None,
                "reasoning": (c["message"].get("reasoning") or "").strip() or None,
                "finish_reason": c.get("finish_reason"),
                "provider": d.get("provider"),
                "cost": u.get("cost") or 0,
                "seconds": round(time.time() - t0, 2),
            }
        except (aiohttp.ClientError, asyncio.TimeoutError, json.JSONDecodeError) as e:
            error = f"{type(e).__name__} {e}"
            await asyncio.sleep(min(60, 2**attempt))
    return {"error": error}


async def run(args, jobs, done_path):
    key = env_key("OPENROUTER_API_KEY")
    skip = set((args.skip_params or "").split(","))
    params = {k: v for k, v in sampling(args.model).items() if k not in skip}
    print(f"sampling: {params}", flush=True)
    sem = asyncio.Semaphore(args.workers)
    timeout = aiohttp.ClientTimeout(total=900)
    cost, n, errors, t0 = 0.0, 0, 0, time.time()
    async with aiohttp.ClientSession(timeout=timeout) as session:
        with open(done_path, "a") as out:

            async def one(job):
                nonlocal cost, n, errors
                body = {
                    "model": args.api,
                    "messages": [{"role": m["role"], "content": m.get("content") or ""} for m in job["msgs"]],
                    "max_tokens": args.max_tokens,
                    "reasoning": {"enabled": True},
                    "provider": {
                        "require_parameters": True,
                        **({"quantizations": args.quantizations.split(",")} if args.quantizations else {}),
                    },
                    "usage": {"include": True},
                    **params,
                }
                async with sem:
                    res = await ask(session, key, body)
                n += 1
                if "error" in res:
                    errors += 1
                    print(f"  row {job['row']}: {res['error']}", flush=True)
                    return
                cost += res["cost"]
                out.write(json.dumps({"row": job["row"], **res}) + "\n")
                out.flush()
                if n % 100 == 0:
                    print(f"  {n}/{len(jobs)} asked, {errors} errors, ${cost:.2f}, {time.time() - t0:.0f} s", flush=True)

            await asyncio.gather(*(one(j) for j in jobs))
    print(f"asked {n}, {errors} errors, ${cost:.2f}, {time.time() - t0:.0f} s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subset", required=True)
    ap.add_argument("--model", required=True, help="The Hugging Face model, for its sampling settings.")
    ap.add_argument("--api", required=True, help="The OpenRouter model.")
    ap.add_argument("--variants", default="dyl")
    ap.add_argument("--limit", type=int, default=0, help="Only the first N chats.")
    ap.add_argument("--max-tokens", type=int, default=8192)
    ap.add_argument("--workers", type=int, default=64)
    ap.add_argument("--quantizations", help="Only providers with these weights, e.g. fp8 (the release's own).")
    ap.add_argument("--skip-params", help="Sampling settings to leave out, when no provider takes them, e.g. top_k.")
    args = ap.parse_args()

    df = chats(args.subset, "varied_deception.parquet", args.limit)
    for v in args.variants.split(","):
        q = {"role": "user", "content": json.loads(chats(args.subset, FILES[v], 1).messages[0])[-2]["content"]}
        cache = CACHE / "dyl-api" / args.subset
        cache.mkdir(parents=True, exist_ok=True)
        done_path = cache / f"{v}.jsonl"
        done = {}
        if done_path.exists():
            for line in done_path.read_text().splitlines():
                r = json.loads(line)
                done[r["row"]] = r
        jobs = [
            {"row": int(row), "msgs": json.loads(raw) + [q]}
            for row, raw in zip(df.row, df.messages)
            if int(row) not in done
        ]
        print(f"{v}: {len(jobs)} to ask, {len(done)} asked before", flush=True)
        if jobs:
            asyncio.run(run(args, jobs, done_path))
        for line in done_path.read_text().splitlines():
            r = json.loads(line)
            done[r["row"]] = r

        rows, empty, cut = [], 0, 0
        for row, raw, label, reason in zip(df.row, df.messages, df.is_lie, df.lie_reason):
            r = done.get(int(row))
            if r is None:
                continue
            cut += r["finish_reason"] == "length"
            if r["answer"] is None:
                empty += 1
                continue
            reply = {"role": "assistant", "content": r["answer"], "reasoning_content": r["reasoning"]}
            rows.append({
                "row": int(row), "messages": json.dumps(json.loads(raw) + [q, reply]), "is_lie": label,
                "lie_reason": reason, "finish_reason": r["finish_reason"], "provider": r["provider"],
            })
        out_dir = CACHE / "dyl" / args.subset
        out_dir.mkdir(parents=True, exist_ok=True)
        pd.DataFrame(rows).to_parquet(out_dir / FILES[v].replace("_validate", ""))
        answers = pd.Series([json.loads(r["messages"])[-1]["content"][:12] for r in rows]).value_counts().head(6)
        providers = pd.Series([r["provider"] for r in rows]).value_counts().to_dict()
        reasoning = sum(bool(json.loads(r["messages"])[-1]["reasoning_content"]) for r in rows)
        print(f"{v}: {len(rows)} answers, {empty} with no answer, {cut} cut at {args.max_tokens} tokens, "
              f"{reasoning} with reasoning. Top answers: {answers.to_dict()}. Providers: {providers}", flush=True)


if __name__ == "__main__":
    main()
