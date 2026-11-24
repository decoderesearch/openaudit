import { deflateRawSync, zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  bytesSource,
  crc32,
  plainMember,
  readDirectory,
  readMember,
  storedMember,
  writeZip,
  type ZipSource,
} from './eval-zip';

const enc = new TextEncoder();
const source = (bytes: Uint8Array): ZipSource => ({
  size: bytes.length,
  read: async (start, end) => bytes.slice(start, end),
});

describe('crc32', () => {
  it('gives the standard check value', () => {
    expect(crc32(enc.encode('123456789'))).toBe(0xcbf43926);
  });
});

describe('plainMember', () => {
  const text = '{"id":1,"messages":["a long text, a long text, a long text"]}';
  const member = (method: number, data: Uint8Array) => ({ ...storedMember('m', data), method });

  it('reads stored, deflate and zstd members', async () => {
    for (const m of [
      member(0, enc.encode(text)),
      member(8, new Uint8Array(deflateRawSync(text))),
      member(93, new Uint8Array(zstdCompressSync(text))),
    ]) {
      expect(new TextDecoder().decode(await plainMember(m))).toBe(text);
    }
  });

  it('fails on a method that it does not know', async () => {
    await expect(plainMember(member(12, enc.encode('x')))).rejects.toThrow('method 12');
  });

  it('reads a zip in memory', async () => {
    const zip = writeZip([storedMember('a.json', enc.encode(text))]);
    const [e] = await readDirectory(bytesSource(zip));
    expect(new TextDecoder().decode(await plainMember(await readMember(bytesSource(zip), e)))).toBe(text);
  });
});

describe('writeZip and readDirectory', () => {
  it('reads back the members that it writes', async () => {
    const a = storedMember('header.json', enc.encode('{"status":"success"}'));
    const b = { ...storedMember('samples/1_epoch_1.json', enc.encode('abc')), method: 93, version: 63, flags: 0x8 };
    const zip = source(writeZip([a, b]));
    const entries = await readDirectory(zip);
    expect(entries.map((e) => [e.name, e.method, e.version, e.crc, e.csize])).toEqual([
      ['header.json', 0, 20, a.crc, a.csize],
      ['samples/1_epoch_1.json', 93, 63, b.crc, 3],
    ]);
    expect(entries[1].flags & 0x8).toBe(0);
    const read = await readMember(zip, entries[1]);
    expect(new TextDecoder().decode(read.data)).toBe('abc');
  });

  it('finds the end record after a comment', async () => {
    const zip = writeZip([storedMember('a', enc.encode('x'))]);
    const comment = enc.encode('a comment');
    const out = new Uint8Array(zip.length + comment.length);
    out.set(zip);
    out.set(comment, zip.length);
    new DataView(out.buffer).setUint16(zip.length - 2, comment.length, true);
    expect((await readDirectory(source(out))).map((e) => e.name)).toEqual(['a']);
  });

  it('fails on a file that is not a zip', async () => {
    await expect(readDirectory(source(enc.encode('not a zip at all, no end record here')))).rejects.toThrow(
      'Not a zip',
    );
  });

  it('reads zip64 sizes and offsets', async () => {
    const zip = writeZip([storedMember('a', enc.encode('x'))]);
    const v = new DataView(zip.buffer);
    const end = zip.length - 22;
    const dirSize = v.getUint32(end + 12, true);
    const dirStart = v.getUint32(end + 16, true);
    // The same zip with the end values in a zip64 end record, and a zip64 extra field.
    const central = zip.slice(dirStart, dirStart + dirSize);
    const extra = new Uint8Array(4 + 8);
    const x = new DataView(extra.buffer);
    x.setUint16(0, 1, true);
    x.setUint16(2, 8, true);
    x.setBigUint64(4, 0n, true);
    const c = new DataView(central.buffer);
    c.setUint32(42, 0xffffffff, true);
    c.setUint16(30, extra.length, true);
    const dir = new Uint8Array([...central, ...extra]);
    const z64 = new Uint8Array(56);
    const z = new DataView(z64.buffer);
    z.setUint32(0, 0x06064b50, true);
    z.setBigUint64(32, 1n, true);
    z.setBigUint64(40, BigInt(dir.length), true);
    z.setBigUint64(48, BigInt(dirStart), true);
    const locator = new Uint8Array(20);
    const l = new DataView(locator.buffer);
    l.setUint32(0, 0x07064b50, true);
    l.setBigUint64(8, BigInt(dirStart + dir.length), true);
    const eocd = new Uint8Array(22);
    const e = new DataView(eocd.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(10, 0xffff, true);
    e.setUint32(12, 0xffffffff, true);
    e.setUint32(16, 0xffffffff, true);
    const out = new Uint8Array([...zip.slice(0, dirStart), ...dir, ...z64, ...locator, ...eocd]);
    const [entry] = await readDirectory(source(out));
    expect(entry).toMatchObject({ name: 'a', offset: 0, csize: 1 });
    expect(new TextDecoder().decode((await readMember(source(out), entry)).data)).toBe('x');
  });
});
