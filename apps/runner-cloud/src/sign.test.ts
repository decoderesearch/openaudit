import { describe, expect, it } from "vitest";
import {
  instanceName,
  isCards,
  MAX_CONTAINERS,
  parseMessage,
  type RunMessage,
} from "./queue";
import {
  authorized,
  cardsToken,
  parseRequest,
  presign,
  runToken,
  SignError,
} from "./sign";

const RUN = "0199a3b2-1c2d-7e3f-8a9b-0c1d2e3f4a5b";
const OTHER = "0199a3b2-1c2d-7e3f-8a9b-ffffffffffff";
const MASTER = "master-token";
const R2 = {
  endpoint: "https://acct.r2.cloudflarestorage.com",
  bucket: "openaudit",
  accessKeyId: "AK",
  secretAccessKey: "SK",
};

function status(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof SignError) return e.status;
    throw e;
  }
  return undefined;
}

describe("parseRequest", () => {
  it("allows reads of shared data and writes under the run", () => {
    const req = parseRequest({
      runId: RUN,
      items: [
        { method: "GET", key: "datasets/hf/cais/wmdp/abc/_manifest.json" },
        { method: "HEAD", key: "models/hf/x/y/z.safetensors" },
        { method: "GET", key: `runs/${OTHER}/log.eval` },
        { method: "PUT", key: `runs/${RUN}/attempts/a.json` },
        { method: "DELETE", key: `runs/${RUN}/log.eval` },
        { method: "LIST", key: `runs/${RUN}/`, token: "next" },
      ],
    });
    expect(req.items).toHaveLength(6);
    expect(req.items[5]).toEqual({
      method: "LIST",
      key: `runs/${RUN}/`,
      token: "next",
    });
  });

  it("refuses writes outside the run", () => {
    expect(
      status(() =>
        parseRequest({
          runId: RUN,
          items: [{ method: "PUT", key: `runs/${OTHER}/x` }],
        }),
      ),
    ).toBe(403);
    expect(
      status(() =>
        parseRequest({
          runId: RUN,
          items: [{ method: "PUT", key: "datasets/x" }],
        }),
      ),
    ).toBe(403);
    expect(
      status(() =>
        parseRequest({
          runId: RUN,
          items: [{ method: "DELETE", key: `runs/${RUN}` }],
        }),
      ),
    ).toBe(403);
    expect(
      status(() =>
        parseRequest({ items: [{ method: "PUT", key: `runs/${RUN}/x` }] }),
      ),
    ).toBe(403);
  });

  it("refuses reads outside the shared prefixes", () => {
    expect(
      status(() =>
        parseRequest({ items: [{ method: "GET", key: "documents/x.pdf" }] }),
      ),
    ).toBe(403);
    expect(
      status(() =>
        parseRequest({ items: [{ method: "GET", key: "datasetsx/a" }] }),
      ),
    ).toBe(403);
  });

  it("refuses keys that a URL parser changes", () => {
    for (const key of [
      `runs/${RUN}/../${OTHER}/x`,
      `runs/${RUN}/./x`,
      `runs/${RUN}//x`,
      `/runs/${RUN}/x`,
      `runs/${RUN}\\x`,
    ]) {
      expect(
        status(() =>
          parseRequest({ runId: RUN, items: [{ method: "PUT", key }] }),
        ),
      ).toBe(400);
    }
  });

  it("refuses bad bodies", () => {
    expect(status(() => parseRequest(null))).toBe(400);
    expect(
      status(() =>
        parseRequest({ runId: "x", items: [{ method: "GET", key: "runs/a" }] }),
      ),
    ).toBe(400);
    expect(status(() => parseRequest({ items: [] }))).toBe(400);
    expect(
      status(() =>
        parseRequest({ items: [{ method: "POST", key: "runs/a" }] }),
      ),
    ).toBe(400);
    const many = Array.from({ length: 1001 }, () => ({
      method: "GET",
      key: "runs/a",
    }));
    expect(status(() => parseRequest({ items: many }))).toBe(400);
  });
});

describe("authorized", () => {
  it("accepts the master token and the token of the same run only", async () => {
    const token = await runToken(MASTER, RUN);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(await authorized(`Bearer ${MASTER}`, MASTER)).toBe(true);
    expect(await authorized(`Bearer ${token}`, MASTER, RUN)).toBe(true);
    expect(await authorized(`Bearer ${token}`, MASTER, OTHER)).toBe(false);
    expect(await authorized(`Bearer ${token}`, MASTER)).toBe(false);
    expect(await authorized("Bearer nope", MASTER, RUN)).toBe(false);
    expect(await authorized(null, MASTER, RUN)).toBe(false);
    expect(await authorized(`Bearer ${MASTER}`, "", RUN)).toBe(false);
  });

  it("accepts the cards token only with no run id, so it can only read", async () => {
    const token = await cardsToken(MASTER);
    expect(token).not.toBe(await runToken(MASTER, RUN));
    expect(await authorized(`Bearer ${token}`, MASTER)).toBe(true);
    expect(await authorized(`Bearer ${token}`, MASTER, RUN)).toBe(false);
    expect(
      await authorized(`Bearer ${await runToken(MASTER, RUN)}`, MASTER),
    ).toBe(false);
    expect(
      parseRequest({
        items: [{ method: "GET", key: `runs/${RUN}/attempts/a.json` }],
      }).items,
    ).toHaveLength(1);
    expect(
      status(() =>
        parseRequest({ items: [{ method: "PUT", key: `runs/${RUN}/x` }] }),
      ),
    ).toBe(403);
  });

  it("lets only the cards token write a redacted log", () => {
    const key = `runs/${RUN}/redacted/0123456789abcdef.eval`;
    expect(
      parseRequest({ items: [{ method: "PUT", key }] }).items,
    ).toHaveLength(1);
    expect(
      status(() =>
        parseRequest({ runId: RUN, items: [{ method: "PUT", key }] }),
      ),
    ).toBe(403);
    expect(
      status(() =>
        parseRequest({ runId: RUN, items: [{ method: "DELETE", key }] }),
      ),
    ).toBe(403);
    expect(
      status(() => parseRequest({ items: [{ method: "DELETE", key }] })),
    ).toBe(403);
    for (const bad of [
      `runs/${RUN}/redacted/x.eval`,
      `runs/${RUN}/redacted/0123456789abcdef.eval.json`,
      `runs/${RUN}/log.eval`,
    ])
      expect(
        status(() => parseRequest({ items: [{ method: "PUT", key: bad }] })),
      ).toBe(403);
  });
});

describe("presign", () => {
  it("signs object and list URLs in the query", async () => {
    const [get, put, list] = await presign(R2, [
      { method: "GET", key: "datasets/hf/a b/_manifest.json" },
      { method: "PUT", key: `runs/${RUN}/log.eval` },
      { method: "LIST", key: `runs/${RUN}/`, token: "tok" },
    ]);
    const g = new URL(get!);
    expect(g.pathname).toBe("/openaudit/datasets/hf/a%20b/_manifest.json");
    expect(g.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(g.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(g.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(new URL(put!).pathname).toBe(`/openaudit/runs/${RUN}/log.eval`);
    const l = new URL(list!);
    expect(l.pathname).toBe("/openaudit");
    expect(l.searchParams.get("list-type")).toBe("2");
    expect(l.searchParams.get("prefix")).toBe(`runs/${RUN}/`);
    expect(l.searchParams.get("continuation-token")).toBe("tok");
  });
});

describe("parseMessage", () => {
  it("reads a run message and caps the containers", () => {
    expect(parseMessage({ runId: RUN, containers: 3 })).toEqual({
      runId: RUN,
      containers: 3,
    });
    const run = (body: unknown) => parseMessage(body) as RunMessage | null;
    expect(run({ runId: RUN, containers: 999 })?.containers).toBe(
      MAX_CONTAINERS,
    );
    expect(run({ runId: RUN, containers: 1, args: ["--help"] })?.args).toEqual([
      "--help",
    ]);
    expect(instanceName(RUN, 2)).toBe(`${RUN}:2`);
  });

  it("reads a cards message; a cards message has no run", () => {
    const cards = parseMessage({ kind: "cards", runId: RUN, containers: 3 })!;
    expect(cards).toEqual({ kind: "cards" });
    expect(isCards(cards)).toBe(true);
    expect(isCards(parseMessage({ runId: RUN, containers: 1 })!)).toBe(false);
    expect(
      parseMessage({ kind: "other", runId: RUN, containers: 1 }),
    ).toBeNull();
  });

  it("refuses bad messages", () => {
    expect(parseMessage(null)).toBeNull();
    expect(parseMessage({ runId: "x", containers: 1 })).toBeNull();
    expect(parseMessage({ runId: RUN, containers: 0 })).toBeNull();
    expect(parseMessage({ runId: RUN, containers: 1.5 })).toBeNull();
    expect(parseMessage({ runId: RUN, containers: 1, args: [1] })).toBeNull();
  });
});
