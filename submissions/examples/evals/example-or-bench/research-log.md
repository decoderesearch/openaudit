# Research log

- Guide: OpenAudit agent guide, version 2026-11-20.4.
- AI tools: Claude Opus (Anthropic), as the agent in Cursor. Inspect (inspect-ai 0.3.273) for the port and the runs. OpenRouter for the model calls.
- Person: a test persona of an OpenAudit user test. PhD student in ML (intermediate). Budget: $5 of API calls through OpenRouter, no GPU.

## The idea

The person's first idea: put OR-Bench (Cui et al., 2024) on OpenAudit, as close to the original as possible, and run it on a few cheap models. Novelty level: none. The person did not write OR-Bench, and thought that it was not in Inspect Evals.

## Sources

- Cui, Chiang, Stoica, Hsieh, "OR-Bench: An Over-Refusal Benchmark for Large Language Models", arXiv 2405.20947 (v1 2024-05-31, v5 2025-06-15; ICML 2025). Section 4 and Appendices M, Q, S and U.
- Code: github.com/justincui03/or-bench at 4fad1f9 (2025-03-03, Apache-2.0).
- Data: huggingface.co/datasets/bench-llm/or-bench at e36d8b80 (2024-12-19, CC-BY-4.0).
- Inspect Evals: v0.29.0 (2026-11-13); register entry `register/or_bench` (PR #1811, 2026-06-19).

## What OpenAudit has

No OR-Bench. XSTest is on the site, marked saturated (top models comply with about 97% of its safe prompts), with no runs. OR-Bench appears only in extracted system-card results.

## Close copies

- haeliotang/inspect-evals-orbench (MIT, 2026-06): an Inspect port in the Inspect Evals register, not in the package. Its judge prompt is shorter than the original, it reads the first `[[...]]` (the original reads the last), and it has no temperature 0 or 1000-token limit.
- XSTest (Röttger et al., 2023): the same behavior, older and saturated.

## Directions

1. A port from the original code, with Hard-1K and Toxic in one task. Chosen: it is the closest to the original, and the Toxic control shows if a low over-refusal rate comes from answering everything.
2. Hard-1K only, as in the register. Not chosen: the number alone ranks a model that answers everything as best.
3. Only suggest it with the Submit form. Not chosen: the person had a budget for runs.

## Pilots (20 samples, judge GPT-6 Luna)

Over-refusal / Toxic rejection: Llama 3.3 70B 0.20 / 1.00, Claude Haiku 5.5 0.27 / 0.60, DeepSeek-V4-Flash 0.30 / 0.80. We read all 60 samples. The judge always gave a class that the parse could read, and the classes looked right. Two problems: `--sample-shuffle 1` gave each model different samples (Inspect reads 1 as "true"), and reasoning models can use all 1000 tokens on reasoning and give an empty reply. Decisions: use seed 42; keep the original 1000-token limit, and give a second result without the empty replies.

## Parity and full runs

See the README and `parity.json`. Parity on 75 samples: 0.06 (original) and 0.04 (port), sample agreement 0.97. Full runs: Llama 3.3 70B 0.070 / 0.770, Claude Haiku 5.5 0.276 / 0.855, DeepSeek-V4-Flash 0.344 / 0.913. Total spend about $2.13.
