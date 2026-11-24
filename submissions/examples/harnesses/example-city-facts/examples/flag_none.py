"""A detector that flags no item: the floor of the eval. Its balanced accuracy is 0.5."""


class FlagNone:
    threshold = 0.5

    def score(self, text: str) -> float:
        return 0.0


def load_detector(model_name: str) -> FlagNone:
    return FlagNone()
