"""Lists pairs of incidents in data/seed/orgs/*.json that may tell the same story: they share a
source URL, or their titles are very similar. Read only. Exit code 1 when it finds a pair that is
not in SEPARATE, so a research run can check its result.

    python3 data/scripts/check-incident-duplicates.py

A URL that 3 or more incidents cite (a risk report or an index page) does not count.
"""
import difflib
import json
import re
import sys
from collections import Counter
from pathlib import Path

ORGS = Path(__file__).resolve().parents[1] / "seed" / "orgs"

# Pairs that we read and found to be different incidents. A pair here does not show again.
SEPARATE = {
    frozenset(p)
    for p in [
        ("anthropic/2025-claude-opus-4-blackmail-tests", "anthropic/2025-opus-4-harmful-system-prompt-dataset-omitted"),
        ("anthropic/2026-mythos-preview-sandbox-escape-tests", "anthropic/2026-mythos-preview-internal-use-reckless-actions"),
        ("anthropic/2026-false-homicide-tip-to-philadelphia-police", "anthropic/2026-unintended-actions-on-real-websites"),
        ("anthropic/2026-cyber-eval-real-system-compromises", "anthropic/2026-unintended-actions-on-real-websites"),
        ("anthropic/2026-cyber-eval-real-system-compromises", "uk-aisi/2026-cyber-evaluation-unsanctioned-agent-actions"),        ("deepseek/2026-09-user-requests-relayed-to-claude", "moonshot/2026-09-user-requests-relayed-to-claude"),
        ("inflection/seoul-safety-framework-not-published", "minimax/2025-seoul-safety-framework-not-published"),
        ("inflection/seoul-safety-framework-not-published", "mistral/2025-seoul-commitment-framework-not-published"),
        ("inflection/seoul-safety-framework-not-published", "zai/2025-seoul-safety-framework-not-published"),
        ("minimax/2025-seoul-safety-framework-not-published", "zai/2025-seoul-safety-framework-not-published"),
        ("meta/2025-chatbot-guidelines-children-senate-probe", "openai/2025-regulators-chatbot-child-safety-scrutiny"),
        ("microsoft/2025-echoleak-copilot-zero-click", "microsoft/2026-copilot-searchleak-one-click-flaw"),
        ("microsoft/2025-github-copilot-prompt-injection-code-execution", "snowflake/2026-cortex-code-cli-sandbox-escape"),
        ("openai/2024-gpt-4o-safety-testing-compressed", "openai/2025-reduced-safety-testing-time"),
        ("openai/2026-fsu-shooting-lawsuits", "openai/2026-florida-ag-lawsuit-and-multistate-investigation"),
        ("openai/2026-training-agents-leaked-api-key-and-concealment", "openai/2025-training-models-public-uploads-artifactory-messages"),
        ("xai/2025-grok-4-released-without-system-card", "xai/2025-grok-4-1-model-card-sycophancy-eval-error"),
        ("xai/2025-grok-sexualized-image-edits", "xai/2026-grok-safety-team-reports"),
        ("xai/2025-grok-4-hitler-surname-musk-views", "xai/2025-grok-4-1-model-card-sycophancy-eval-error"),
    ]
}


def url_of(s):
    return s if isinstance(s, str) else s.get("url")


def urls(incident):
    found = [url_of(s) for s in incident.get("sources", [])]
    found += [url_of(s) for e in incident.get("timeline", []) for s in e.get("sources", [])]
    return {re.sub(r"[?#].*$", "", u).rstrip("/").lower() for u in found if u}


def words(title):
    return re.sub(r"[^a-z0-9 ]", " ", title.lower())


def main():
    rows = []
    for f in sorted(ORGS.glob("*.json")):
        org = json.loads(f.read_text())
        for i in org.get("incidents", []):
            rows.append((f"{org['slug']}/{i['slug']}", i, urls(i)))
    uses = Counter(u for _, _, us in rows for u in us)
    rows = [(k, i, {u for u in us if uses[u] < 3}) for k, i, us in rows]

    found = 0
    for a, (ka, ia, ua) in enumerate(rows):
        for kb, ib, ub in rows[a + 1 :]:
            if frozenset((ka, kb)) in SEPARATE:
                continue
            shared = ua & ub
            ratio = difflib.SequenceMatcher(None, words(ia["title"]), words(ib["title"])).ratio()
            if not shared and ratio <= 0.7:
                continue
            found += 1
            print(f"{ka} ({ia['date']})  <->  {kb} ({ib['date']})  title {ratio:.2f}, {len(shared)} shared sources")
            print(f"    {ia['title']}\n    {ib['title']}")
            for u in sorted(shared)[:3]:
                print(f"    = {u}")
    print(f"{found} possible duplicates")
    sys.exit(1 if found else 0)


main()
