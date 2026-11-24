import { bytesSource, crc32, plainMember, readDirectory, readMember, storedMember, writeZip } from '@/lib/eval-zip';
import { zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { attemptLogOf } from './attempt-log';

const enc = new TextEncoder();

/** A member as Inspect writes it: zstd, with the CRC and size of the plain bytes. */
function zstdMember(name: string, value: unknown) {
  const plain = enc.encode(JSON.stringify(value));
  const data = new Uint8Array(zstdCompressSync(plain));
  return { ...storedMember(name, plain), method: 93, crc: crc32(plain), csize: data.length, data };
}

const runLog = writeZip([
  zstdMember('header.json', { status: 'success' }),
  zstdMember('samples/s1_epoch_1.json', { id: 's1', epoch: 1, metadata: { k: 'v' } }),
  zstdMember('samples/s2_epoch_1.json', { id: 's2', epoch: 1 }),
]);

const attempt = (settings?: object) =>
  ({ sampleId: 's1', epoch: 1, input: 'Q', target: 'T', scores: {}, seconds: 1, settings }) as never;

async function members(zip: Uint8Array) {
  const src = bytesSource(zip);
  const out: Record<string, { method: number; value: Record<string, unknown> }> = {};
  for (const e of await readDirectory(src)) {
    const text = new TextDecoder().decode(await plainMember(await readMember(src, e)));
    out[e.name] = { method: e.method, value: JSON.parse(text) };
  }
  return out;
}

describe('attemptLogOf', () => {
  it('keeps the header and the sample, with no compression, and adds the settings', async () => {
    const settings = { runId: 'r', roles: [{ id: 'judge', model: 'j' }] };
    const got = await members((await attemptLogOf(bytesSource(runLog), attempt(settings)))!);
    expect(Object.keys(got)).toEqual(['header.json', 'samples/s1_epoch_1.json', 'summaries.json']);
    expect(Object.values(got).every((m) => m.method === 0)).toBe(true);
    expect(got['samples/s1_epoch_1.json'].value.metadata).toEqual({ k: 'v', openauditSettings: settings });
    expect((got['summaries.json'].value as unknown as { metadata: unknown }[])[0].metadata).toEqual({
      openauditSettings: settings,
    });
  });

  it('keeps the sample as it is when the attempt has no settings', async () => {
    const got = await members((await attemptLogOf(bytesSource(runLog), attempt()))!);
    expect(got['samples/s1_epoch_1.json'].value).toEqual({ id: 's1', epoch: 1, metadata: { k: 'v' } });
  });

  it('is null when the log does not have the sample', async () => {
    const other = { ...(attempt() as object), sampleId: 's9' } as never;
    expect(await attemptLogOf(bytesSource(runLog), other)).toBeNull();
  });
});
