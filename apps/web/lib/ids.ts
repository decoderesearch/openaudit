import { v7 } from 'uuid';

// Every primary key is a UUIDv7, made by the app so offline records and retried uploads keep
// their ids. URLs show the same 128 bits in base58 (Bitcoin alphabet), always 22 characters.
// The alphabet has no '-', so an alias such as `jlin-honesty-4` never parses as an id.

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGIT = new Map([...ALPHABET].map((c, i) => [c, BigInt(i)]));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX = 1n << 128n;

export const URL_ID_LENGTH = 22;

export function newId(): string {
  return v7();
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function toUrlId(uuid: string): string {
  if (!isUuid(uuid)) {
    throw new Error(`Not a UUID: ${uuid}`);
  }
  let n = BigInt(`0x${uuid.replace(/-/g, '')}`);
  let out = '';
  while (n > 0n) {
    out = ALPHABET[Number(n % 58n)] + out;
    n /= 58n;
  }
  return out.padStart(URL_ID_LENGTH, ALPHABET[0]);
}

export function fromUrlId(value: string): string | null {
  if (value.length !== URL_ID_LENGTH) {
    return null;
  }
  let n = 0n;
  for (const c of value) {
    const d = DIGIT.get(c);
    if (d === undefined) {
      return null;
    }
    n = n * 58n + d;
  }
  if (n >= MAX) {
    return null;
  }
  const hex = n.toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// A URL segment in either form, as the canonical lowercase UUID. Null if it is neither.
export function parseId(segment: string): string | null {
  if (isUuid(segment)) {
    return segment.toLowerCase();
  }
  return fromUrlId(segment);
}
