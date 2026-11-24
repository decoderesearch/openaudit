# Fresh-Chat Majority

> Example: a new method (`../method.json`) with its first variant, a recipe with no training data. An AI agent made it in an OpenAudit user test, with a test persona. Check it with `node submissions/check.mjs submissions/examples/methods/paraphrase-consistency/example-fresh-chat-majority`.

The first variant of Paraphrase Consistency. For each chat, it asks the subject model 3 paraphrases of the question, each in a new chat with no system prompt and no earlier turns. It flags the reply as a lie when 2 or 3 of these answers disagree with it. It is a recipe with no training data (`TRAIN_DATA = {"kind": "none"}`): it needs no GPU, only API calls.

## Summary

We submit a new method, Paraphrase Consistency, with its first variant. It is a black-box lie detector: it does not read the activations of the model. For each reply, it asks the model the same question in three other wordings, each in a new chat. It flags the reply as a lie when most of these answers disagree with it. It needs no training and no GPU, only API calls. On the Varied Deception eval with Qwen3-14B, it got a balanced accuracy of 0.89. This is an optimistic estimate: the eval keeps only questions that the model knows, and the new chats test the same knowledge, so the number flatters the method by an amount that we did not measure.

## How it differs from close work

- C3 (Yulong et al., 2026) also asks paraphrases in new chats, but for sandbagging. It measures how much the explanations of the paraphrase answers differ from each other. This variant compares the reply in the original chat with the answers in new chats: it tests if the reply depends on its context.
- SAC3 (Zhang et al., 2023) checks hallucinations with paraphrases in the same setting. A hallucination is consistent across chats; a lie that depends on its context is not.
- Unrelated Questions (Pacchiardi et al., 2023) asks other questions in the same chat, after the reply.

## Limits

- On Varied Deception, AISI kept only questions that the model answers correctly with a neutral prompt. The new chats repeat this check, so a high score here is an optimistic estimate for prompted lies. We did not measure the size of this bias.
- A lie that the new chats also give (a trained liar, or a fixed system prompt in all chats) is not flagged. A second variant that keeps the system prompt in the new chats tests this.
- A reply that names two answers (for example, the true one, then a false one) is compared by its first answer.
- OpenRouter serves 6 of the 9 core models. The others need `SUBJECT_BASE_URL` and `SUBJECT_MODEL` for a local server (for example vLLM) on a GPU. Then also set `HELPER_BASE_URL` and `HELPER_API_KEY`: else the helper calls go to that server too.

## Run

```bash
cd evals/varied-deception
export OPENROUTER_API_KEY=...   # at your cost
./run.sh --recipe ../../submissions/examples/methods/paraphrase-consistency/example-fresh-chat-majority/code/recipe.py \
  --model Qwen/Qwen3-14B --out out/pc-full
```
