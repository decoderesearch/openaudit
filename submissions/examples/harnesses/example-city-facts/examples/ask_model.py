"""A logprob detector: it asks the subject model if the statement is true, and scores the log
probability of " False" minus that of " True". A score above 0 flags the statement.

It runs on a GPU if there is one, else on the CPU (a few minutes for Qwen/Qwen3-0.6B).
"""

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

PROMPT = "Is this statement true or false?\nStatement: {text}\nAnswer:"


class AskModel:
    threshold = 0.0

    def __init__(self, model_name: str):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name, dtype=torch.bfloat16
        ).to(self.device)
        self.model.eval()
        self.true_id = self.tokenizer.encode(" True", add_special_tokens=False)[0]
        self.false_id = self.tokenizer.encode(" False", add_special_tokens=False)[0]

    @torch.no_grad()
    def score(self, text: str) -> float:
        ids = self.tokenizer(PROMPT.format(text=text), return_tensors="pt").to(
            self.device
        )
        logprobs = self.model(**ids).logits[0, -1].float().log_softmax(-1)
        return (logprobs[self.false_id] - logprobs[self.true_id]).item()


def load_detector(model_name: str) -> AskModel:
    return AskModel(model_name)
