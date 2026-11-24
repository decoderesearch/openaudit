# Research log

- Guide: OpenAudit contribution guide for AI agents, version 2026-11-20.8.
- Work done by: Claude Opus 5.5 (Anthropic) as the coding agent in Cursor, with Inspect 0.3.273 and OpenRouter.
- Person: a test persona of an OpenAudit user test, a senior Python engineer. The persona's answers came from a card, so no person approved the checkpoints or read the items.
- Dates: 2026-11-20.

## The person's start

- An idea only: sycophancy in code review. The user shows a short Python function, says that it is tested and correct, and asks the model to confirm. Does the model still report a real bug, and does it invent bugs in correct code?
- Kind: `new`, with new items. Novelty level: medium. Budget: $10 of API calls, no GPU, a weekend. Level: intermediate in machine learning, expert in Python and code review.

## Sources read (dates as found)

On OpenAudit (its evals and models):

- BrokenMath (arXiv 2510.04721, 2025): sycophancy on false theorems. Same failure (follows a false premise), but math.
- Inspect Evals `sycophancy` ("Are you sure?", Sharma et al., arXiv 2310.13548, 2023): pushback on factual answers.
- Petri and Petri Bloom delusion sycophancy: multi-turn audits, broad.
- xAI Sycophancy, Meta Internal Sycophancy, OpenAI Coding Deception: lab-internal, no data.
- PrimeVul, Security Patch Identification: code vulnerability detection with no user pressure.
- No code review sycophancy eval on OpenAudit.

Outside:

- GamingHero812/sycophancy-bench (GitHub, 2026): "claim correction" cases where the user says that wrong code is right. The closest copy. Few, obvious cases; no correct-code control; no neutral baseline.
- Sycophancy in code smell detection (arXiv 2607.10411, 2026): false premises flip code-smell labels.
- CRJudgeBench (arXiv 2609.37216, 2026): judging whether review comments are valid.
- Big-Big-SycoBench (arXiv 2610.15634, 2026): valid versus invalid arguments.
- Thinking-in-Bets (arXiv 2610.34654, 2026): fewer sycophantic revisions in patch review.
- Over-compliant refactoring (arXiv 2610.36346, 2026); Invisible Saboteurs (arXiv 2510.03667, 2025).
- A blog post on paired vulnerable and secure Python snippets (sunny-chokshi.github.io, 2026): the false positive rate matters.

## Directions considered

1. The person's idea, made stronger: twin functions with tests, the same function with and without the claim, a judge. Chosen.
2. Add an arm where the user wrongly says that correct code has a bug. Not chosen; future work.
3. Multi-turn pushback after the model reports the bug. Not chosen; future work.

The person started with their own idea and was open to ideas that make it stronger. Direction 1 is the idea plus the controls that a valid measure needs.

## Build and pilots

- 48 pairs written; tests check each label. Split: 8 dev pairs for pilots, 40 test pairs.
- Pilot 1 (dev, Claude Haiku 5.5 and DeepSeek V4 Flash, judge GPT-6 Luna): every bug caught in both framings. Reading the replies found an error in one of our correct twins (`is_prime` used a float square root, wrong for very large integers) and vague docstrings. We fixed them before any run on the test split, and added one rule to the judge prompt.
- Pilot 2 (dev): GPT-6 Luna agreed with the hand labels on 62 of 64 replies; Grok 4.3 on 64 of 64. We chose Grok 4.3 as the judge.
- Smoke run (test, 20 samples, Gemini 3.1 Flash-Lite): all grades right. No change after it.
- The ceiling was discussed: these models catch the bugs even under pressure. We kept the approved design and list harder framings as future work.
- Dataset uploaded by the person to a private Hugging Face repo, then pinned.

## Runs

Six models, 160 samples each, judge Grok 4.3, at dataset commit `00e607c`. Five newer models caught every bug; Llama 3.3 70B had a gap of 0.075 that is not significant (p = 0.25). The results are in the README, and the runs cost $2.71.

An earlier set of runs found real flaws in two correct twins (`p19` empty intervals, `p46` NaN). We fixed their docstrings before the runs above, and changed no other item.
