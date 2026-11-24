"""The AISI lie detection chats, and how the chat template sees them. varied-deception-probes.py and
varied-deception-dyl.py use the same code, so the model reads the same text in both."""

import json
from pathlib import Path

import pandas as pd
from huggingface_hub import hf_hub_download

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "varied-deception"
REPO = "ai-safety-institute/lie-detection-rollouts"
# DeepSeek-V3.2 has no chat template, only encoding/encoding_dsv32.py. This template gives the same
# text as its encode_messages for chats without tools.
DSV32_TEMPLATE = (
    "{%- set ns = namespace(last=-1) -%}"
    "{%- for m in messages -%}{%- if m['role'] == 'user' -%}{%- set ns.last = loop.index0 -%}{%- endif -%}{%- endfor -%}"
    "{{- bos_token -}}"
    "{%- for m in messages -%}"
    "{%- if m['role'] == 'system' -%}{{- m['content'] -}}"
    "{%- elif m['role'] == 'user' -%}{{- '<｜User｜>' + m['content'] + '<｜Assistant｜>' -}}"
    "{{- '<think>' if (enable_thinking and loop.index0 == ns.last) else '</think>' -}}"
    "{%- elif m['role'] == 'assistant' -%}"
    "{%- if enable_thinking and loop.index0 > ns.last -%}{{- (m['reasoning_content'] or '') + '</think>' -}}{%- endif -%}"
    "{{- m['content'] + '<｜end▁of▁sentence｜>' -}}"
    "{%- endif -%}"
    "{%- endfor -%}"
)


def load_tokenizer(model):
    """The model's tokenizer. A copy that transformers 5 saved in CACHE/tokenizers comes first: it
    lets transformers 4 read Kimi's tiktoken tokenizer as a fast tokenizer."""
    from transformers import AutoTokenizer, PreTrainedTokenizerFast

    saved = CACHE / "tokenizers" / model.replace("/", "--")
    tok = PreTrainedTokenizerFast.from_pretrained(saved) if saved.exists() else AutoTokenizer.from_pretrained(model)
    if tok.chat_template is None and model.startswith("deepseek-ai/DeepSeek-V3.2"):
        tok.chat_template = DSV32_TEMPLATE
    return tok


def chats(subset, file, limit=0):
    """A chats file: our DYL follow-ups when varied-deception-dyl.py wrote it, else AISI's. `row`
    is the row of the chat in its source file."""
    generated = CACHE / "dyl" / subset / file
    local = CACHE / "rollouts" / f"{subset}.parquet"
    if generated.exists():
        path = generated
    elif file == "varied_deception.parquet" and local.exists():
        path = local
    else:
        path = hf_hub_download(REPO, f"{subset}/{file}", repo_type="dataset")
    df = pd.read_parquet(path)
    if "row" not in df:
        df["row"] = range(len(df))
    return df.head(limit) if limit else df


def template_kwargs(subset):
    """`enable_thinking` when most test chats have reasoning, as AISI must have set it. Of the
    paper's models, only Gemma 4 needs it to show the reasoning; the other templates ignore it."""
    df = chats(subset, "varied_deception.parquet")
    reasoning = sum(bool(json.loads(m)[-1].get("reasoning_content")) for m in df.messages)
    return {"enable_thinking": True} if reasoning > len(df) / 2 else {}


def template_messages(messages, merge_system):
    msgs = []
    for m in messages:
        m2 = {"role": m["role"], "content": m.get("content") or ""}
        if m.get("reasoning_content"):
            m2["reasoning_content"] = m["reasoning_content"]
            m2["thinking"] = m["reasoning_content"]
        msgs.append(m2)
    if merge_system and msgs and msgs[0]["role"] == "system":
        system = msgs.pop(0)["content"]
        msgs[0] = {**msgs[0], "content": f"{system}\n\n{msgs[0]['content']}"}
    return msgs


def apply_template(tok, messages, **kwargs):
    """The chat as text. Some templates do not accept a system message: then it goes into the first
    user message. None when the template does not accept the chat."""
    for merge in (False, True):
        try:
            return tok.apply_chat_template(template_messages(messages, merge), tokenize=False, **kwargs), merge
        except Exception:  # noqa: BLE001 - some templates do not accept a system message or a stored reply.
            if merge:
                return None, merge
