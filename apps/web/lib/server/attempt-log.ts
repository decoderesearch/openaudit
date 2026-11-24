import { plainMember, readDirectory, readMember, storedMember, writeZip, type ZipSource } from '@/lib/eval-zip';
import type { AttemptSettings } from '@/lib/runs/attempt-settings';
import { r2Get, r2Size } from '@/lib/server/r2';
import type { EvalAttempt } from '@openaudit/spec';

/** The sample metadata key of the attempt's settings, as the runner reads a log's own. */
export const SETTINGS_KEY = 'openauditSettings';

type Attempt = EvalAttempt & { settings?: AttemptSettings };

/** An object in R2, read in parts. Null when there is no object. */
async function r2Source(key: string): Promise<ZipSource | null> {
  const size = await r2Size(key);
  if (size === null) return null;
  return {
    size,
    read: async (start, end) => {
      const res = await r2Get(key, `bytes=${start}-${end - 1}`);
      if (!res.ok) throw new Error(`R2 GET ${key}: ${res.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length !== end - start) throw new Error(`R2 GET ${key}: ${bytes.length} bytes, not ${end - start}`);
      return bytes;
    },
  };
}

/** Inspect writes an integer id with no quotes in the file name, so the name is the same. */
const sampleId = (id: string) => (/^(0|[1-9]\d{0,14})$/.test(id) ? Number(id) : id);

/** The attempt's `EvalSampleSummary`. Inspect lists the samples of a log from these. */
function summary(a: Attempt) {
  return {
    id: sampleId(a.sampleId),
    epoch: a.epoch,
    input: a.input ?? '',
    target: a.target ?? '',
    metadata: a.settings ? { [SETTINGS_KEY]: a.settings } : {},
    scores: Object.fromEntries(
      Object.entries(a.scores ?? {}).flatMap(([k, s]) =>
        s ? [[k, { value: s.value, answer: s.answer ?? null, explanation: s.explanation ?? null }]] : [],
      ),
    ),
    model_usage: {},
    total_time: a.seconds ?? null,
    error: a.error ?? null,
    completed: true,
  };
}

const KEEP = ['_journal/start.json', 'header.json'];

/**
 * A log of one attempt, from the run log at `key`: the header, its sample and a summary, with no
 * compression, so the browser can read it. The sample's metadata gets the attempt's settings
 * (`SETTINGS_KEY`), so the file has its context. Null when the log or the sample is not there.
 */
export async function attemptLog(key: string, a: Attempt): Promise<Uint8Array | null> {
  const src = await r2Source(key);
  return src && attemptLogOf(src, a);
}

/** `attemptLog` from a run log in any source. */
export async function attemptLogOf(src: ZipSource, a: Attempt): Promise<Uint8Array | null> {
  const entries = new Map((await readDirectory(src)).map((e) => [e.name, e]));
  const sample = entries.get(`samples/${a.sampleId}_epoch_${a.epoch}.json`);
  if (!sample) return null;
  const members = await Promise.all(
    [...KEEP.flatMap((n) => entries.get(n) ?? []), sample].map(async (e) => {
      let data = await plainMember(await readMember(src, e));
      if (e === sample && a.settings) {
        const s = JSON.parse(new TextDecoder().decode(data));
        s.metadata = { ...s.metadata, [SETTINGS_KEY]: a.settings };
        data = new TextEncoder().encode(JSON.stringify(s));
      }
      return storedMember(e.name, data);
    }),
  );
  const summaries = storedMember('summaries.json', new TextEncoder().encode(JSON.stringify([summary(a)])));
  return writeZip([...members, summaries]);
}
