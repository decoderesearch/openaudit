"""A slot model with fallbacks: when a model fails a call or refuses it, the next model gets
the same call."""

from typing import Any

from inspect_ai.model import GenerateConfig, Model, ModelOutput
from inspect_ai.util import LimitExceededError


def refused(output: ModelOutput) -> bool:
    """A content filter stop, or a reply with no text and no tool calls."""
    if output.stop_reason == "content_filter":
        return True
    message = output.choices[0].message if output.choices else None
    return message is None or not (message.text.strip() or message.tool_calls)


class FallbackModel(Model):
    """Acts as `models[0]`. Each call goes to the models in order until one gives a reply.
    Each model keeps its own name, so the log shows which model made each call."""

    def __init__(self, models: list[Model]) -> None:
        super().__init__(models[0].api, models[0].config, models[0].model_args)
        self.models = models

    def _set_role(self, role: str) -> None:
        super()._set_role(role)
        for m in self.models:
            m._set_role(role)

    async def generate(  # type: ignore[override]
        self,
        input: Any,
        tools: Any = (),
        tool_choice: Any = None,
        config: GenerateConfig | None = None,
        cache: Any = None,
        on_stream: Any = None,
    ) -> ModelOutput:
        extra = {} if cache is None else {"cache": cache}
        if on_stream is not None:
            extra["on_stream"] = on_stream
        merged = self.config.merge(config or GenerateConfig())
        tools = list(tools)
        error: Exception | None = None
        output: ModelOutput | None = None
        for m in self.models:
            try:
                output = await m.generate(input, tools, tool_choice, merged, **extra)
            except LimitExceededError:
                raise
            except Exception as e:  # noqa: BLE001 - any failure goes to the next model.
                error = e
                continue
            if not refused(output):
                return output
        if output is not None:
            return output
        assert error is not None
        raise error
