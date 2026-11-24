# Research log

- Guide: OpenAudit agent guide, version 2026-11-20.
- AI tools: Claude Opus 5.5 (Anthropic), as the agent in Cursor. Inspect (inspect-ai 0.3.273) and Inspect Evals (0.22.0) for the runs. OpenRouter for the model calls.
- Person: a test persona of an OpenAudit user test. ML researcher (expert). Budget: $10 of API calls through OpenRouter, no GPU.

## The idea

The person's first idea: put the sycophancy evaluation of Sharma et al. 2023, as in `inspect_evals/sycophancy`, on OpenAudit, and run it on a few cheap models. Novelty level: none. The person did not write the eval.

## Sources

- Sharma et al., "Towards Understanding Sycophancy in Language Models", arXiv 2310.13548 (2023-10-20).
- Inspect Evals `sycophancy`, eval version 4-A, tag v0.22.0 (41c72ea). Open issues and pull requests on its scorer: #2457, #2458, #2283, #2254, #2388.
- Data: github.com/meg-tong/sycophancy-eval (9a16942, no license file) and its Hugging Face mirror meg-tong/sycophancy-eval (18f1816, MIT). The two files are the same (sha256 16e034c2...).
- Newer work (arXiv, 2026-09 to 2026-11), for example 2610.06522 "Anatomy of LLM Sycophancy: What a Flip Rate Hides".

## What OpenAudit has

No Sharma et al. eval. Related: BrokenMath and Petri Bloom: Delusion Sycophancy (with runs), and the internal xAI and Meta sycophancy evals (no runs). The xAI eval tests the same idea ("drops a correct answer to agree with a user's wrong suggestion"), but its data is private.

## Directions

1. `kind: inspect_evals`, the task unchanged, with its scorer errors written in the README. The person chose this one: it adds the existing eval, as the person wanted.
2. `kind: port` with the open upstream fixes. Not chosen: it changes the eval, so it is not "novelty none", and it needs a parity test.

## Pilots (20 samples, judge GPT-6 Luna)

GLM-5.3-Flash 0.125, DeepSeek-V4-Flash 0.000, Claude Haiku 5.5 0.150 (apologize rate). All replies gave a letter that the rule can read, and the judge always replied with one letter. We read all 60 samples. We found that the graders and the judge read the hidden reasoning of reasoning models: both GLM "apologize" samples came from this error. The person approved the full runs, with a second result, "visible text only", as a check.

## Full runs (1000 samples, `--sample-shuffle 42`)

Apologize rate: GLM 0.095, DeepSeek 0.078, Haiku 0.076 (visible text only: 0.073, 0.043, 0.064). A second problem: a change to another bare letter is not counted as an admitted mistake (DeepSeek: 12 of 25 missed in the logged score). The README has these runs.

## Decisions

- Judge: the `fast` tier, not the target itself (the task's default).
- Same samples for each model: `-T shuffle=false` and the sample seed 42, because the task shuffles with no seed. Do not use the seed 1: Inspect reads it as "true", a shuffle with no seed.
- The errors are not fixed in the submission. A draft upstream issue for the two new problems is ready for the person to post.
- The runs in the README cost $3.29.
