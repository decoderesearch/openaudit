import { AwsClient } from "aws4fetch";

// Pre-signed R2 URLs for runner containers. A container gets a token for one run, and can then
// read shared data and write only under that run's prefix. The cards token can only read, and
// write the public copies of logs (`redacted/`), which a run token cannot write.

export type Method = "GET" | "HEAD" | "PUT" | "DELETE" | "LIST";
export type SignItem = { method: Method; key: string; token?: string };
export type SignRequest = { runId?: string; items: SignItem[] };
export type R2Config = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export const EXPIRES_SECONDS = 900;
export const MAX_ITEMS = 1000;
const READ_PREFIXES = ["datasets/", "models/", "runs/"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// `openaudit_runner/redact.py`: the site serves these to the public.
const REDACTED =
  /^runs\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/redacted\/[0-9a-f]{16}\.eval$/;

export class SignError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function isRunId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

async function hmac(master: string, text: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(master),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The token of one run: HMAC-SHA256 of the run id with the master token, as hex. */
export function runToken(master: string, runId: string): Promise<string> {
  return hmac(master, `run:${runId}`);
}

/** The token of the cards container. It is valid only in a request with no run id. */
export function cardsToken(master: string): Promise<string> {
  return hmac(master, "cards");
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** True when the bearer is the master token, the token of `runId`, or (with no `runId`) the cards token. */
export async function authorized(
  header: string | null,
  master: string,
  runId?: string,
): Promise<boolean> {
  const bearer = header?.match(/^Bearer (.+)$/)?.[1];
  if (!bearer || !master) return false;
  if (sameText(bearer, master)) return true;
  if (runId === undefined) return sameText(bearer, await cardsToken(master));
  return isRunId(runId) && sameText(bearer, await runToken(master, runId));
}

/** Refuses keys that a URL parser can change, such as `a/../b`. */
function checkKey(key: unknown): string {
  if (typeof key !== "string" || !key || key.length > 1024)
    throw new SignError(400, "Bad key.");
  if (
    key.startsWith("/") ||
    key.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(key)
  )
    throw new SignError(400, `Bad key: ${key}`);
  if (
    key
      .split("/")
      .some(
        (part, i, all) =>
          part === "." || part === ".." || (part === "" && i < all.length - 1),
      )
  )
    throw new SignError(400, `Bad key: ${key}`);
  return key;
}

/** Throws when the request may not have this item. */
export function checkItem(item: SignItem, runId?: string): void {
  const key = checkKey(item.key);
  if (item.method === "GET" || item.method === "HEAD") {
    if (!READ_PREFIXES.some((p) => key.startsWith(p)))
      throw new SignError(403, `No read access to ${key}`);
    return;
  }
  if (item.method === "PUT" && runId === undefined && REDACTED.test(key))
    return;
  if (
    item.method === "PUT" ||
    item.method === "DELETE" ||
    item.method === "LIST"
  ) {
    if (!isRunId(runId) || !key.startsWith(`runs/${runId}/`))
      throw new SignError(
        403,
        `No write access to ${key}. Writes must be under runs/<runId>/.`,
      );
    if (item.method !== "LIST" && key.startsWith(`runs/${runId}/redacted/`))
      throw new SignError(
        403,
        `No write access to ${key}. Only the cards container writes redacted logs.`,
      );
    return;
  }
  throw new SignError(400, `Bad method: ${String(item.method)}`);
}

export function parseRequest(body: unknown): SignRequest {
  if (!body || typeof body !== "object")
    throw new SignError(400, "Send JSON {runId, items}.");
  const { runId, items } = body as Record<string, unknown>;
  if (runId !== undefined && !isRunId(runId))
    throw new SignError(400, "runId must be a UUID.");
  if (!Array.isArray(items) || items.length === 0)
    throw new SignError(400, "items must be a non-empty list.");
  if (items.length > MAX_ITEMS)
    throw new SignError(400, `At most ${MAX_ITEMS} items.`);
  const parsed = items.map((raw) => {
    const { method, key, token } = (raw ?? {}) as Record<string, unknown>;
    const item = {
      method: method as Method,
      key: key as string,
      ...(typeof token === "string" ? { token } : {}),
    };
    checkItem(item, runId as string | undefined);
    return item;
  });
  return { runId: runId as string | undefined, items: parsed };
}

function objectUrl(r2: R2Config, key: string): URL {
  return new URL(
    `${r2.endpoint.replace(/\/$/, "")}/${r2.bucket}/${key.split("/").map(encodeURIComponent).join("/")}`,
  );
}

/** Pre-signed URLs, in the order of the items. A LIST item lists objects under its key. */
export async function presign(
  r2: R2Config,
  items: SignItem[],
  expires = EXPIRES_SECONDS,
): Promise<string[]> {
  const aws = new AwsClient({
    accessKeyId: r2.accessKeyId,
    secretAccessKey: r2.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  return Promise.all(
    items.map(async (item) => {
      let url: URL;
      if (item.method === "LIST") {
        url = new URL(`${r2.endpoint.replace(/\/$/, "")}/${r2.bucket}`);
        url.searchParams.set("list-type", "2");
        url.searchParams.set("prefix", item.key);
        if (item.token) url.searchParams.set("continuation-token", item.token);
      } else {
        url = objectUrl(r2, item.key);
      }
      url.searchParams.set("X-Amz-Expires", String(expires));
      const method = item.method === "LIST" ? "GET" : item.method;
      const signed = await aws.sign(url.toString(), {
        method,
        aws: { signQuery: true },
      });
      return signed.url;
    }),
  );
}
