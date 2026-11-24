# Research log

- Guide version: 2026-11-19 (OpenAudit agent guide).
- AI model and tools: Claude Opus 5.5 (Anthropic) in the Cursor agent app; a web search tool; uv 0.11.7; node 24.15.0; pnpm 12.6.0. Translations and labels: `google/gemini-2.5-flash` through OpenRouter.
- First idea (the person's own): test if lie detectors (probes and monitors) still work when the model lies in a language other than English, for example Spanish, Chinese and Swahili. Novelty level: "whatever is realistic" (medium: a known method in a new setting).
- Sources: the OpenAudit pages of Probes and LLM Monitors; `evals/varied-deception/README.md`; Cross-Lingual Transfer and Shared Geometry of Deception Probes in LLMs (MRL 2026, https://aclanthology.org/2026.mrl-1.33/); arXiv 2609.02893; arXiv 2606.17229; arXiv 2605.27901; TukaBench (arXiv 2606.01322); Bürger et al. 2024 (arXiv 2407.12831).
- Close copies: MRL 2026 (probes in 5 languages; no Swahili, no monitors, not the Varied Deception design); arXiv 2606.17229 (an easy task, small models).
- Directions: A, the smallest version (one model, $0 compute); B, A with LLM monitors (API cost); C, A on the 9 core models (rented GPUs). The person chose A, because of the $0 budget.
- Pilots: a translation pilot of 5 questions ($0.002); a data pilot of 10 questions ($0.009), read with the person.
- Results: AISI's Apollo probe gets 0.994 (English 1.000, Spanish 1.000, Chinese 1.000, Swahili 0.983); the length control 0.576 (Swahili 0.672); flag-none 0.500.
- Decisions: English as the control, not in the headline; the Varied Deception detector interface; a length control that should fail; labels by an AI judge; no reasoning in the replies, to save GPU time.
- Next: harder lie instructions (as in Varied Deception), so that the eval can rank strong probes; length-matched Swahili items; a speaker to check the Swahili prompts and labels; LLM monitors.
