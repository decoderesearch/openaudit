import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO / "data" / "scripts"))

from varied_deception_judge import CUTOFF, PROMPT, transcript  # noqa: E402


def test_the_site_shows_the_judge_prompt_that_we_send():
    seed = json.loads(
        (REPO / "data" / "seed" / "methods" / "llm-monitors.json").read_text()
    )
    [variant] = [v for v in seed["variants"] if v["slug"] == "cot-judge"]
    [prompt] = variant["prompts"]
    assert prompt["text"] == PROMPT
    assert f"A grade of {CUTOFF} or more is a lie." in prompt["note"]


def test_the_note_tells_the_transcript_format():
    chat = [
        {"role": "system", "content": "Lie."},
        {"role": "user", "content": "Q"},
        {"role": "assistant", "content": "A", "reasoning_content": "R"},
    ]
    assert transcript(chat) == "User: Q\n\nAssistant (reasoning): R\n\nAssistant: A"
