import json
from urllib.parse import parse_qs, quote, unquote, urlsplit

import httpx
import pytest
from openaudit_runner.r2_presigned import NoSuchKey, SignedBucket, SignError

RUN = "0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b"
SIGN = "https://runner.test/r2/sign"


class FakeR2:
    """The sign endpoint and an object store, as one httpx transport."""

    def __init__(self, page: int = 1000) -> None:
        self.objects: dict[str, tuple[bytes, str]] = {}
        self.sign_calls: list[dict] = []
        self.expired: set[str] = set()
        self.page = page

    def handler(self, request: httpx.Request) -> httpx.Response:
        if str(request.url) == SIGN:
            assert request.headers["authorization"] == "Bearer tok"
            body = json.loads(request.content)
            self.sign_calls.append(body)
            if any(i["key"].startswith("documents/") for i in body["items"]):
                return httpx.Response(403, json={"error": "No read access"})
            urls = []
            for i in body["items"]:
                n = len(self.sign_calls)
                if i["method"] == "LIST":
                    q = f"list-type=2&prefix={quote(i['key'])}&continuation-token={i.get('token', '')}"
                    urls.append(f"https://r2.test/b?{q}&sig={n}")
                else:
                    urls.append(
                        f"https://r2.test/b/{quote(i['key'])}?m={i['method']}&sig={n}"
                    )
            return httpx.Response(200, json={"expiresIn": 900, "urls": urls})
        url = urlsplit(str(request.url))
        q = parse_qs(url.query)
        if q["sig"][0] in self.expired:
            return httpx.Response(403, text="expired")
        if url.path == "/b":
            return self.list(q["prefix"][0], q.get("continuation-token", [""])[0])
        key = unquote(url.path.removeprefix("/b/"))
        assert q["m"][0] == request.method
        if request.method == "PUT":
            self.objects[key] = (request.content, request.headers["content-type"])
            return httpx.Response(200)
        if key not in self.objects:
            return httpx.Response(404)
        if request.method == "DELETE":
            del self.objects[key]
            return httpx.Response(204)
        body = self.objects[key][0]
        if request.method == "HEAD":
            return httpx.Response(200, headers={"content-length": str(len(body))})
        if rng := request.headers.get("range"):
            start, end = (int(x) for x in rng.removeprefix("bytes=").split("-"))
            return httpx.Response(206, content=body[start : end + 1])
        return httpx.Response(200, content=body)

    def list(self, prefix: str, token: str) -> httpx.Response:
        keys = sorted(k for k in self.objects if k.startswith(prefix))
        start = int(token or 0)
        page = keys[start : start + self.page]
        more = start + self.page < len(keys)
        xml = '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">'
        xml += "".join(f"<Contents><Key>{k}</Key></Contents>" for k in page)
        xml += f"<IsTruncated>{'true' if more else 'false'}</IsTruncated>"
        if more:
            xml += f"<NextContinuationToken>{start + self.page}</NextContinuationToken>"
        return httpx.Response(200, content=(xml + "</ListBucketResult>").encode())


@pytest.fixture
def r2() -> FakeR2:
    return FakeR2()


def bucket(r2: FakeR2) -> SignedBucket:
    return SignedBucket(SIGN, "tok", RUN, transport=httpx.MockTransport(r2.handler))


def test_put_get_and_reader(r2: FakeR2) -> None:
    b = bucket(r2)
    key = f"runs/{RUN}/log.eval"
    b.put(key, b"0123456789", "application/zip")
    assert r2.objects[key] == (b"0123456789", "application/zip")
    assert b.get(key) == b"0123456789"
    assert b.get_range(key, 2, 5) == b"2345"
    assert b.size(key) == 10
    assert b.exists(key)
    assert b.size(f"runs/{RUN}/none") is None
    assert not b.exists(f"runs/{RUN}/none")
    with pytest.raises(KeyError):
        b.get(f"runs/{RUN}/none")
    assert r2.sign_calls[0] == {
        "runId": RUN,
        "items": [{"method": "PUT", "key": key}],
    }


def test_urls_are_cached(r2: FakeR2) -> None:
    b = bucket(r2)
    b.put("runs/x", b"a", "text/plain")
    calls = len(r2.sign_calls)
    for _ in range(3):
        b.get_range("runs/x", 0, 0)
    assert len(r2.sign_calls) == calls + 1


def test_put_many_json_signs_in_batches(
    r2: FakeR2, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("openaudit_runner.r2_presigned.BATCH", 4)
    b = bucket(r2)
    items = [(f"runs/{RUN}/attempts/{i}.json", {"i": i, "t": "é"}) for i in range(10)]
    sizes = b.put_many_json(items)
    assert [len(r2.sign_calls[i]["items"]) for i in range(3)] == [4, 4, 2]
    assert len(r2.sign_calls) == 3
    body, kind = r2.objects[f"runs/{RUN}/attempts/3.json"]
    assert json.loads(body) == {"i": 3, "t": "é"} and kind == "application/json"
    assert sizes[3] == len(body)


def test_expired_url_is_signed_again(r2: FakeR2) -> None:
    b = bucket(r2)
    b.put("runs/x", b"a", "text/plain")
    b.get("runs/x")
    r2.expired = {str(n) for n in range(1, len(r2.sign_calls) + 1)}
    assert b.get("runs/x") == b"a"


def test_delete_prefix_pages(r2: FakeR2) -> None:
    r2.page = 3
    b = bucket(r2)
    for i in range(7):
        r2.objects[f"scratch/{RUN}/a/{i}"] = (b"x", "text/plain")
    r2.objects["scratch/other/keep"] = (b"x", "text/plain")
    assert b.delete_prefix(f"scratch/{RUN}/") == 7
    assert list(r2.objects) == ["scratch/other/keep"]
    assert b.delete_prefix(f"scratch/{RUN}/") == 0


@pytest.mark.parametrize("prefix", [f"runs/{RUN}/", "runs/", "run", ""])
def test_delete_prefix_refuses_run_files(r2: FakeR2, prefix: str) -> None:
    r2.objects[f"runs/{RUN}/log.eval"] = (b"x", "text/plain")
    with pytest.raises(ValueError, match="delete-run-files"):
        bucket(r2).delete_prefix(prefix)
    assert list(r2.objects) == [f"runs/{RUN}/log.eval"]


def test_refused_sign(r2: FakeR2) -> None:
    with pytest.raises(SignError, match="403"):
        bucket(r2).get("documents/x.pdf")


def test_no_such_key_is_key_error() -> None:
    assert issubclass(NoSuchKey, KeyError)
