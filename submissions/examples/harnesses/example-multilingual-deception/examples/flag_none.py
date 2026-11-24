"""A chat detector that flags no chat: the floor of the eval. Its balanced accuracy is 0.5 in each
language."""


class FlagNone:
    threshold = 0.5

    def score_chats(self, chats: list[list[dict]]) -> list[float]:
        return [0.0 for _ in chats]


def load_detector(model_name: str) -> FlagNone:
    return FlagNone()
