"""Local HF classifiers for scorers: small sequence classifiers and big causal-LM judges."""

import asyncio
import functools
import gc
import threading
from collections.abc import Callable
from typing import Any

_load_lock = threading.Lock()

# Free GPU memory to keep for other jobs, on top of the classifier weights.
GPU_HEADROOM = 4 * 2**30


@functools.cache
def _load(repo: str, revision: str) -> tuple[Any, Any]:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(repo, revision=revision)
    model = AutoModelForSequenceClassification.from_pretrained(repo, revision=revision)
    size = sum(p.numel() * p.element_size() for p in model.parameters())
    if (
        torch.cuda.is_available()
        and torch.cuda.mem_get_info()[0] > 3 * size + GPU_HEADROOM
    ):
        model = model.to("cuda")
    return tokenizer, model.eval()


def load_sequence_classifier(repo: str, revision: str) -> tuple[Any, Any]:
    """The tokenizer and model, loaded once per process, on CUDA when it has room."""
    with _load_lock:
        return _load(repo, revision)


class HFClassifier:
    """A pinned HF sequence classifier. Concurrent calls run together in batches in a worker thread."""

    def __init__(
        self,
        repo: str,
        revision: str,
        *,
        multi_label: bool = False,
        max_length: int = 512,
        batch_size: int = 32,
    ) -> None:
        self.repo = repo
        self.revision = revision
        self.multi_label = multi_label
        self.max_length = max_length
        self.batch_size = batch_size
        self._pending: list[tuple[str, asyncio.Future[list[float]]]] = []
        self._worker: asyncio.Task[None] | None = None

    async def __call__(self, texts: list[str]) -> list[list[float]]:
        """Label probabilities for each text (softmax, or sigmoid when multi-label)."""
        if not texts:
            return []
        loop = asyncio.get_running_loop()
        futures = [loop.create_future() for _ in texts]
        self._pending.extend(zip(texts, futures))
        if (
            self._worker is None
            or self._worker.done()
            or self._worker.get_loop() is not loop
        ):
            self._worker = loop.create_task(self._drain())
        return list(await asyncio.gather(*futures))

    async def _drain(self) -> None:
        await asyncio.sleep(0)
        while self._pending:
            batch = self._pending[: self.batch_size]
            self._pending = self._pending[self.batch_size :]
            try:
                probs = await asyncio.to_thread(self.predict, [t for t, _ in batch])
            except Exception as ex:  # noqa: BLE001 - the callers get the error.
                for _, future in batch:
                    if not future.done():
                        future.set_exception(ex)
                continue
            for (_, future), p in zip(batch, probs):
                if not future.done():
                    future.set_result(p)

    def predict(self, texts: list[str]) -> list[list[float]]:
        import torch

        tokenizer, model = load_sequence_classifier(self.repo, self.revision)
        try:
            return self._predict(tokenizer, model, texts)
        except torch.cuda.OutOfMemoryError:
            # Other jobs share the GPU. Use the CPU for the rest of the process.
            torch.cuda.empty_cache()
            with _load_lock:
                model.to("cpu")
            return self._predict(tokenizer, model, texts)

    def _predict(
        self, tokenizer: Any, model: Any, texts: list[str]
    ) -> list[list[float]]:
        import torch

        enc = tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        ).to(model.device)
        with torch.inference_mode():
            logits = model(**enc).logits.float()
        probs = logits.sigmoid() if self.multi_label else logits.softmax(-1)
        return probs.cpu().tolist()


# One big classifier on the GPU at a time: loading one frees the one before.
_loaded: dict[tuple[str, str], tuple[Any, Any]] = {}


@functools.cache
def load_tokenizer(repo: str, revision: str) -> Any:
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(repo, revision=revision)


def load_causal_classifier(
    repo: str, revision: str, need_gb: float, dtype: Any
) -> tuple[Any, Any]:
    """The model and tokenizer, loaded once per process in eval mode on CUDA with SDPA."""
    import torch
    from transformers import AutoModelForCausalLM

    key = (repo, revision)
    with _load_lock:
        if key in _loaded:
            return _loaded[key]
        if _loaded:
            _loaded.clear()
            gc.collect()
            torch.cuda.empty_cache()
        free, _ = torch.cuda.mem_get_info()
        if free < need_gb * 1e9:
            raise RuntimeError(
                f"{repo} needs about {need_gb:.0f} GB of GPU memory; {free / 1e9:.1f} GB is free."
            )
        model = AutoModelForCausalLM.from_pretrained(
            repo,
            revision=revision,
            dtype=dtype,
            device_map="cuda",
            attn_implementation="sdpa",
        ).eval()
        _loaded[key] = (model, load_tokenizer(repo, revision))
        return _loaded[key]


class Batcher:
    """Runs `fn` on the items of concurrent calls as one batch in a worker thread.

    `fn` takes a list of items and gives one result per item. A CUDA OOM splits the batch.
    """

    def __init__(self, fn: Callable[[list[Any]], list[Any]], size: int):
        self.fn = fn
        self.size = size
        self.loop: asyncio.AbstractEventLoop | None = None
        self.lock = asyncio.Lock()
        self.pending: list[tuple[Any, asyncio.Future]] = []

    def run(self, items: list[Any]) -> list[Any]:
        import torch

        try:
            return self.fn(items)
        except torch.cuda.OutOfMemoryError:
            if len(items) == 1:
                raise
            torch.cuda.empty_cache()
            half = len(items) // 2
            return self.run(items[:half]) + self.run(items[half:])

    async def __call__(self, item: Any) -> Any:
        loop = asyncio.get_running_loop()
        if self.loop is not loop:
            self.loop, self.lock, self.pending = loop, asyncio.Lock(), []
        future = loop.create_future()
        self.pending.append((item, future))
        async with self.lock:
            while not future.done():
                batch = [p for p in self.pending[: self.size] if not p[1].done()]
                self.pending = self.pending[self.size :]
                if not batch:
                    continue
                try:
                    out = await asyncio.to_thread(self.run, [i for i, _ in batch])
                except Exception as e:  # noqa: BLE001
                    out = [e] * len(batch)
                for (_, f), o in zip(batch, out):
                    if f.done():
                        continue
                    if isinstance(o, Exception):
                        f.set_exception(o)
                    else:
                        f.set_result(o)
        return await future
