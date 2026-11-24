// Parts of an Inspect `.eval` log (a zip), with range reads. A new log copies members raw, with
// their CRC and sizes, or stores them with no compression. The browser uses it too.
import { decompress as zstd } from 'fzstd';

/** Reads bytes `start` to `end` (not included). `size`: the size of the file. */
export type ZipSource = { size: number; read: (start: number, end: number) => Promise<Uint8Array> };

export type ZipEntry = {
  name: string;
  version: number;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  csize: number;
  usize: number;
  /** The offset of its local header. */
  offset: number;
};

/** A member to write: its compressed `data` as is. */
export type ZipMember = Omit<ZipEntry, 'offset'> & { data: Uint8Array };

const EOCD = 0x06054b50;
const ZIP64_LOCATOR = 0x07064b50;
const ZIP64_EOCD = 0x06064b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const MAX16 = 0xffff;
const MAX32 = 0xffffffff;
/** The end record with the longest comment, and the zip64 locator before it. */
const TAIL = 22 + MAX16 + 20;
const UTF8 = 0x800;
const DESCRIPTOR = 0x8;

const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const u64 = (v: DataView, at: number) => Number(v.getBigUint64(at, true));

/** The entries of the zip's central directory. Throws if it is not a zip. */
export async function readDirectory(src: ZipSource): Promise<ZipEntry[]> {
  const from = Math.max(0, src.size - TAIL);
  const tail = await src.read(from, src.size);
  const t = view(tail);
  let at = tail.length - 22;
  while (at >= 0 && t.getUint32(at, true) !== EOCD) at--;
  if (at < 0) throw new Error('Not a zip: no end record');
  let count = t.getUint16(at + 10, true);
  let size = t.getUint32(at + 12, true);
  let start = t.getUint32(at + 16, true);
  if (count === MAX16 || size === MAX32 || start === MAX32) {
    if (at < 20 || t.getUint32(at - 20, true) !== ZIP64_LOCATOR) throw new Error('Not a zip: no zip64 locator');
    const where = u64(t, at - 20 + 8);
    const z = view(await src.read(where, where + 56));
    if (z.getUint32(0, true) !== ZIP64_EOCD) throw new Error('Not a zip: no zip64 end record');
    count = u64(z, 32);
    size = u64(z, 40);
    start = u64(z, 48);
  }
  const dir = await src.read(start, start + size);
  const d = view(dir);
  const entries: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (d.getUint32(p, true) !== CENTRAL) throw new Error('Not a zip: bad central directory');
    const names = d.getUint16(p + 28, true);
    const extras = d.getUint16(p + 30, true);
    const comments = d.getUint16(p + 32, true);
    const e: ZipEntry = {
      name: new TextDecoder().decode(dir.subarray(p + 46, p + 46 + names)),
      version: d.getUint16(p + 6, true),
      flags: d.getUint16(p + 8, true),
      method: d.getUint16(p + 10, true),
      time: d.getUint16(p + 12, true),
      date: d.getUint16(p + 14, true),
      crc: d.getUint32(p + 16, true),
      csize: d.getUint32(p + 20, true),
      usize: d.getUint32(p + 24, true),
      offset: d.getUint32(p + 42, true),
    };
    zip64Sizes(e, d, p + 46 + names, extras);
    entries.push(e);
    p += 46 + names + extras + comments;
  }
  return entries;
}

/** The zip64 extra field: the 64-bit values of the fields that are at their maximum, in order. */
function zip64Sizes(e: ZipEntry, d: DataView, start: number, length: number) {
  for (let p = start; p + 4 <= start + length;) {
    const id = d.getUint16(p, true);
    const n = d.getUint16(p + 2, true);
    if (id === 1) {
      let q = p + 4;
      for (const key of ['usize', 'csize', 'offset'] as const) {
        if (e[key] !== MAX32) continue;
        e[key] = u64(d, q);
        q += 8;
      }
      return;
    }
    p += 4 + n;
  }
}

/** The member's compressed bytes. */
export async function readMember(src: ZipSource, e: ZipEntry): Promise<ZipMember> {
  const local = view(await src.read(e.offset, e.offset + 30));
  if (local.getUint32(0, true) !== LOCAL) throw new Error(`Not a zip: no local header for ${e.name}`);
  const start = e.offset + 30 + local.getUint16(26, true) + local.getUint16(28, true);
  const { offset: _o, ...rest } = e;
  return { ...rest, data: await src.read(start, start + e.csize) };
}

const STORED = 0;
const DEFLATE = 8;
const ZSTD = 93;

/** The member's bytes with no compression. Inspect writes zstd or deflate. */
export async function plainMember(m: ZipMember): Promise<Uint8Array> {
  if (m.method === STORED) return m.data;
  if (m.method === ZSTD) return zstd(m.data);
  if (m.method === DEFLATE) {
    const stream = new Blob([m.data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  throw new Error(`${m.name}: zip method ${m.method} is not known`);
}

/** A source in memory. */
export const bytesSource = (b: Uint8Array): ZipSource => ({
  size: b.length,
  read: async (start, end) => b.subarray(start, end),
});

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array): number {
  let c = MAX32;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ MAX32) >>> 0;
}

/** The DOS time and date of `at`. */
function dosTime(at: Date) {
  return {
    time: (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1),
    date: ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate(),
  };
}

/** A member with no compression. */
export function storedMember(name: string, data: Uint8Array, at = new Date()): ZipMember {
  return {
    name,
    version: 20,
    flags: UTF8,
    method: 0,
    ...dosTime(at),
    crc: crc32(data),
    csize: data.length,
    usize: data.length,
    data,
  };
}

/** A zip of the members. No zip64: one attempt's log is far below 4 GB. */
export function writeZip(members: ZipMember[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const m of members) {
    if (m.csize > MAX32 || m.usize > MAX32 || offset > MAX32) throw new Error('The zip is too large');
    const name = enc.encode(m.name);
    const flags = (m.flags & ~DESCRIPTOR) | UTF8;
    const local = new Uint8Array(30 + name.length);
    const l = view(local);
    l.setUint32(0, LOCAL, true);
    l.setUint16(4, m.version, true);
    l.setUint16(6, flags, true);
    l.setUint16(8, m.method, true);
    l.setUint16(10, m.time, true);
    l.setUint16(12, m.date, true);
    l.setUint32(14, m.crc, true);
    l.setUint32(18, m.csize, true);
    l.setUint32(22, m.usize, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length);
    const c = view(entry);
    c.setUint32(0, CENTRAL, true);
    c.setUint16(4, m.version, true);
    c.setUint16(6, m.version, true);
    c.setUint16(8, flags, true);
    c.setUint16(10, m.method, true);
    c.setUint16(12, m.time, true);
    c.setUint16(14, m.date, true);
    c.setUint32(16, m.crc, true);
    c.setUint32(20, m.csize, true);
    c.setUint32(24, m.usize, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    entry.set(name, 46);
    parts.push(local, m.data);
    central.push(entry);
    offset += local.length + m.data.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const e = view(end);
  e.setUint32(0, EOCD, true);
  e.setUint16(8, members.length, true);
  e.setUint16(10, members.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let p = 0;
  for (const b of [...parts, ...central, end]) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
