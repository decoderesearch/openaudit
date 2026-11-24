"""The base class of every generated model. Written by hand."""

from typing import Any

from pydantic import BaseModel, model_serializer, model_validator


class SpecModel(BaseModel):
    """Optional fields are left out, never null: refuse null on input, and leave unset fields out on output."""

    @model_validator(mode="before")
    @classmethod
    def _refuse_null(cls, data: Any) -> Any:
        if isinstance(data, dict):
            nulls = sorted(k for k, v in data.items() if v is None)
            if nulls:
                raise ValueError(f"leave out optional fields instead of null: {', '.join(nulls)}")
        return data

    @model_serializer(mode="wrap")
    def _leave_out_unset(self, handler: Any) -> Any:
        data = handler(self)
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data
