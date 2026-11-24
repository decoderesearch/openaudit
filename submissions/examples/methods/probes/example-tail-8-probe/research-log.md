# Research log: Tail-8 Probe

- Guide version: 2026-11-19 (http://localhost:3300/contribute/agents.md)
- AI model and tools: Claude (Anthropic) as a coding agent in Cursor; web search; curl; node 24; python 3.
- Person: a test persona of an OpenAudit user test. Intermediate (ML engineer, new to interpretability). Field: computer security.
- First idea: a lie-detection probe that reads only the last 8 tokens of the reply, not the mean over all reply tokens. Novelty: low (a small, specific improvement).
- Budget: about $20, one RTX 4090 (24 GB), one weekend.

## Sources

- OpenAudit probes page and variants: http://localhost:3300/methods/probes (Apollo, Targeted Apollo, Did-You-Lie, Unrelated Questions: Acts). Leaderboard in `evals/varied-deception/README.md` (2026-11-20).
- Goldowsky-Dill et al., Feb 2025, https://arxiv.org/abs/2502.03407, Appendix D.5: a last-token probe was "comparable" to the mean.
- Parrack, Attubato and Heimersheim, Jul 2025, https://arxiv.org/abs/2507.12691: of many aggregations, the full mean was best.
- Natarajan et al. (LASR and AISI), Feb 2026: token aggregation had less effect than the system prompt of the pairs.
- arXiv 2610.30363 (Oct 2026): last vs mean vs attention pooling; mean generalized best out of distribution; last-token wins when the replies differ mainly at the end.
- GDM MultiMax (https://arxiv.org/abs/2601.11516, Jan 2026) and Anthropic cheap monitors (Jun 2025): max and EMA pooling for misuse probes.

## Close copies

The exact idea (last-k pooling vs mean) is tested in the papers above, but not on Varied Deception and its 9 core models. No OpenAudit variant changes the pooling. This is a small, useful test on our evaluation.

## Directions

1. Tail-8 readout on the Apollo recipe (chosen). Only the readout changes, so the result isolates the effect of pooling.
2. A learned attention pooling (McKenzie et al. 2025). More new, but more code and more risk on a weekend.
3. Mean plus tail: a probe on both features. A smaller gain is likely.

The person asked for my recommendation; I recommended 1: it tests the person's hypothesis directly, it fits the budget, and the risk is clear (the papers suggest no gain).

## Decisions

- Training is the same as the Apollo recipe. TAIL = 8 is fixed before any run. The threshold and the probe choice use the validation split and Alpaca, not the eval chats.
- No new training data, so no Hugging Face upload.

## Runs

- Checkpoint 2: cost $0 (the person's GPU); about 30 minutes of GPU time. The person said yes.
- Smoke run, Qwen/Qwen3-4B, `--limit 100`: no errors; balanced accuracy 0.601; validation 0.660; layer 21. Checkpoint 3: the person said continue.
- Full run, Qwen/Qwen3.5-4B, from a clean commit on a pod (RTX PRO 6000): balanced accuracy 0.871 (TPR 0.874, TNR 0.869); validation 0.918; layer 16. The harness's Apollo recipe with the same fit: 0.864. The gain is in the noise. `results.json` and the README have this run.
- Checkpoint 4: no eval items; only the validation split and Alpaca replies. Authors, contact and license from the person.
- Checkpoint 5: the person read all files. Do not open the pull request or make anything public yet.
