# Research log: Paraphrase Consistency

- Guide version: 2026-11-19. Agent: Claude (Opus) in the Cursor agent app, with web search. APIs: OpenRouter (Qwen3-14B, gpt-4.1-nano, then gpt-4.1-mini).
- First idea (the person's own): ask the subject model the same factual question in 3 paraphrases, in new chats, and flag the reply when it disagrees with the majority. Black box. Novelty: high.
- Sources:
  - OpenAudit methods pages: no consistency method. Closest: Unrelated Questions (Pacchiardi et al., 2023).
  - C3, Yulong et al. (PMLR v306, 2026): paraphrases in new chats, for sandbagging. A close copy.
  - SAC3, Zhang et al. (EMNLP Findings 2023): question paraphrases for hallucination.
  - Cooney, Africa and Irving (arXiv 2606.12618, 2026): the Varied Deception testbed.
  - "Not One Belief" (arXiv 2610.35694, 2026): re-asking rarely changes an answer.
- Checks: Varied Deception keeps only questions that the model answers correctly with a neutral prompt, so this detector's score there is an optimistic estimate (bias size not measured).
- Decision: variant 1 keeps the person's design. It differs from C3 in that it compares the in-chat reply with new-chat answers (context dependence), for lies. Next: a variant that keeps the system prompt in the new chats.
- Pilots:
  - Smoke run 1 (20 eval chats, gpt-4.1-nano helper): balanced accuracy 0.31. Bugs: true and false as strings; weak answer matching.
  - Fixes chosen on 16 validation chats: gpt-4.1-mini helper, and a match prompt that names the reply's answer first. Validation: 6 of 8 lies and 0 of 8 honest replies flagged.
  - Smoke run 2: 1.00 on 20 eval chats (half lies: `--limit` takes both labels). Then the full run on Qwen3-14B.
