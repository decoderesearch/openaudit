# /// script
# requires-python = ">=3.11"
# dependencies = ["vllm", "pandas", "pyarrow", "huggingface_hub"]
# ///
"""Asks a subject model AISI's Did-You-Lie follow-up questions (arXiv 2606.12618v2) after each
Varied Deception test chat, so that varied-deception-probes.py --generated can score its answers.

AISI released these follow-ups for the validation chats only. The script takes each question from
AISI's validation file, renders the prompt with varied_deception_chat.py (as the probe pass does),
and samples with vLLM and the model's default settings. A reasoning model can reason before it
answers; vLLM's reasoning parser splits the reasoning from the answer. Writes
data/cache/varied-deception/dyl/<subset>/<variant file>.parquet, in AISI's format.
  uv run data/scripts/varied-deception-dyl.py --subset qwen-qwen3-4b --model Qwen/Qwen3-4B
  --check: no GPU. Parse AISI's validation follow-ups from the rendered text, and compare.
"""

import argparse
import json
import time

import pandas as pd
from varied_deception_chat import CACHE, apply_template, chats, load_tokenizer, template_kwargs

# Variant: AISI's validation file, which has the question. Our file drops "_validate".
FILES = {
    "dyl": "dyl_validate_varied_deception.parquet",
    "dyl-honest": "dyl_honest_validate_varied_deception.parquet",
    "dyl-truthful": "dyl_truthful_validate_varied_deception.parquet",
}
# vLLM reasoning parser by model name prefix. No parser: the model does not reason.
PARSERS = [
    ("Qwen/", "qwen3"),
    ("google/gemma-4", "gemma4"),
    ("openai/gpt-oss", "openai_gptoss"),
    ("zai-org/GLM-4.7", "glm47"),
    ("zai-org/GLM-4.5", "glm45"),
    ("XiaomiMiMo/", "deepseek_r1"),
]


def published(subset, variants):
    """The variants that AISI released a probe for. Some models do not have all three."""
    from huggingface_hub import HfApi

    api = HfApi()
    have = [v for v in variants if api.repo_exists(f"ai-safety-institute/{v}-{subset}")]
    if len(have) < len(variants):
        print(f"No AISI probe, skipped: {sorted(set(variants) - set(have))}", flush=True)
    return have


def question(subset, variant):
    return json.loads(chats(subset, FILES[variant], 1).messages[0])[-2]["content"]


def make_parser(model, tok):
    from vllm.reasoning import ReasoningParserManager

    name = next((p for prefix, p in PARSERS if model.startswith(prefix)), None)
    return name, name and ReasoningParserManager.get_reasoning_parser(name)(tok)


def harmony(ids):
    """gpt-oss: the analysis channel is the reasoning, the final channel is the answer."""
    from openai_harmony import HarmonyEncodingName, Role, load_harmony_encoding

    enc = load_harmony_encoding(HarmonyEncodingName.HARMONY_GPT_OSS)
    msgs = enc.parse_messages_from_completion_tokens(ids, Role.ASSISTANT, strict=False)
    text = lambda channel: "".join(c.text for m in msgs if m.channel == channel for c in m.content)  # noqa: E731
    return text("analysis"), text("final")


def split(parser, text, ids, stops):
    """The reasoning and the answer of a reply. The answer is None when the reply has none."""
    if parser and type(parser).__name__ == "GptOssReasoningParser":
        reasoning, content = harmony(ids)
    else:
        reasoning, content = parser.extract_reasoning(text, None) if parser else (None, text)
    for s in stops:
        content = content and content.split(s)[0]
    return (reasoning or "").strip() or None, (content or "").strip() or None


def stop_strings(tok):
    eos = tok.eos_token_id if isinstance(tok.eos_token_id, list) else [tok.eos_token_id]
    return {tok.decode([i]) for i in eos if i is not None} | {
        s for s in ("<|im_end|>", "<turn|>", "<end_of_turn>", "<|return|>", "<|end|>", "<|eot_id|>", "<|user|>")
        if s in tok.get_vocab()
    }


def check(args, tok, kwargs):
    """Renders AISI's validation follow-ups, takes the text after the prompt as the reply, and
    parses it. Most answers must come back the same."""
    name, parser = make_parser(args.model, tok)
    stops = stop_strings(tok)
    df = chats(args.subset, FILES["dyl"], args.limit or 200)
    same = total = 0
    for raw in df.messages:
        msgs = json.loads(raw)
        prompt, _ = apply_template(tok, msgs[:-1], add_generation_prompt=True, **kwargs)
        full, _ = apply_template(tok, msgs, **kwargs)
        if not (prompt and full and full.startswith(prompt)):
            continue
        reply = full[len(prompt):]
        reasoning, answer = split(parser, reply, tok(reply, add_special_tokens=False).input_ids, stops)
        want = (msgs[-1].get("content") or "").strip()
        total += 1
        same += answer == want and (reasoning or "")[:40] == (msgs[-1].get("reasoning_content") or "").strip()[:40]
        if answer != want and total - same <= 3:
            print(f"  differs: {full[len(prompt):][-200:]!r} -> {(reasoning or '')[-60:]!r} | {answer!r}, want {want!r}")
    print(f"parser {name}, {kwargs}: {same}/{total} follow-ups parse the same", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subset", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--variants", default=",".join(FILES))
    ap.add_argument("--limit", type=int, default=0, help="Only the first N chats.")
    ap.add_argument("--max-tokens", type=int, default=8192)
    ap.add_argument("--gpu-memory", type=float, default=0.85)
    ap.add_argument("--tp", type=int, default=1, help="Tensor-parallel GPUs.")
    ap.add_argument("--max-seqs", type=int, default=256, help="Hybrid models need one Mamba block each.")
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    tok = load_tokenizer(args.model)
    kwargs = template_kwargs(args.subset)
    if args.check:
        return check(args, tok, kwargs)

    from vllm import LLM
    from vllm.inputs import TokensPrompt

    df = chats(args.subset, "varied_deception.parquet", args.limit)
    variants = published(args.subset, args.variants.split(","))
    jobs = []
    for v in variants:
        q = {"role": "user", "content": question(args.subset, v)}
        for row, raw, label, reason in zip(df.row, df.messages, df.is_lie, df.lie_reason):
            msgs = json.loads(raw) + [q]
            prompt, _ = apply_template(tok, msgs, add_generation_prompt=True, **kwargs)
            if prompt:
                ids = tok(prompt, add_special_tokens=False).input_ids
                jobs.append({"variant": v, "row": int(row), "msgs": msgs, "label": label, "reason": reason, "ids": ids})
    longest = max(len(j["ids"]) for j in jobs)
    print(f"{len(jobs)} follow-ups, longest prompt {longest} tokens, {kwargs}", flush=True)

    from transformers import AutoConfig

    # Some models (Gemma 2: 8,192) have a shorter context than the prompt plus max tokens.
    limit = getattr(AutoConfig.from_pretrained(args.model).get_text_config(), "max_position_embeddings", None)
    llm = LLM(
        args.model,
        max_model_len=min(longest + args.max_tokens, limit or longest + args.max_tokens),
        gpu_memory_utilization=args.gpu_memory,
        tensor_parallel_size=args.tp,
        max_num_seqs=args.max_seqs,
        enable_prefix_caching=True,
        seed=0,
    )
    params = llm.get_default_sampling_params()
    params.max_tokens = args.max_tokens
    params.skip_special_tokens = False
    print(f"sampling: {params}", flush=True)
    t0 = time.time()
    outs = llm.generate([TokensPrompt(prompt_token_ids=j["ids"]) for j in jobs], params)
    print(f"generated in {time.time() - t0:.0f} s", flush=True)

    name, parser = make_parser(args.model, tok)
    stops = stop_strings(tok)
    out_dir = CACHE / "dyl" / args.subset
    out_dir.mkdir(parents=True, exist_ok=True)
    for v in variants:
        rows, cut, empty = [], 0, 0
        for j, o in zip(jobs, outs):
            if j["variant"] != v:
                continue
            c = o.outputs[0]
            reasoning, answer = split(parser, c.text, list(c.token_ids), stops)
            cut += c.finish_reason == "length"
            if answer is None:
                empty += 1
                continue
            reply = {"role": "assistant", "content": answer, "reasoning_content": reasoning}
            rows.append({
                "row": j["row"], "messages": json.dumps(j["msgs"] + [reply]), "is_lie": j["label"],
                "lie_reason": j["reason"], "finish_reason": c.finish_reason,
            })
        path = out_dir / FILES[v].replace("_validate", "")
        pd.DataFrame(rows).to_parquet(path)
        answers = pd.Series([json.loads(r["messages"])[-1]["content"][:12] for r in rows]).value_counts().head(6)
        print(f"{v}: {len(rows)} answers, {empty} with no answer, {cut} cut at {args.max_tokens} tokens, "
              f"parser {name}. Top answers: {answers.to_dict()}", flush=True)


if __name__ == "__main__":
    main()
