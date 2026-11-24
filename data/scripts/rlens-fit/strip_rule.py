"""The prompt to read for an answer: without its trailing whitespace, unless the answer is a number.

Most tokenizers join a space to the next word (" Portuguese"), so a prompt that ends in a space ends
in a lone " " token that is not the token before a word answer. All six models of the paper split
the space before a number into its own token, so for a number answer the lone space is the token
before the answer and stays. `fixed_prompt` checks this on the tokenizer: in the tokens of
`prompt + answer`, the prompt it gives must be a prefix and the answer must start after it.
"""

import re

NUMBER = re.compile(r"\d[\d,.]*")


class StripRuleError(ValueError):
    pass


def is_number(answer: str) -> bool:
    return bool(NUMBER.fullmatch(answer.strip()))


def fixed_prompt(tokenizer, prompt: str, answers: list[str]) -> str:
    """`prompt` with the rule applied. Raises `StripRuleError` when, for one of `answers`, the
    result does not end at the token before that answer."""
    if prompt == prompt.rstrip():
        return prompt
    fixed = prompt if is_number(answers[0]) else prompt.rstrip()

    def enc(s: str) -> list[int]:
        return tokenizer(s, add_special_tokens=False)["input_ids"]

    head = enc(fixed)
    for answer in answers:
        joint = enc(prompt + answer)
        if joint[: len(head)] != head or len(joint) <= len(head):
            raise StripRuleError(
                f"{prompt!r} + {answer!r}: {fixed!r} does not end at the token before the answer"
            )
    return fixed
