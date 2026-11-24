'use server';

import { getEval } from '@/lib/server/catalog';
import { limitRead } from '@/lib/server/limits';
import { variantMethods } from '@/lib/server/methods';
import {
  detectorKeys,
  detectorSampleList,
  evalSampleList,
  SAMPLE_PAGE,
  type DetectorSampleItem,
  type EvalSampleItem,
  type SampleOrder,
} from '@/lib/server/runs';
import { sampleAccess } from '@/lib/server/terms';

/** One page of the newest version's samples from `offset`, in `order`, for the list on the eval
 * page. `search`: only the samples that match it. `more`: more samples follow. Not in the page's
 * HTML: samples are eval data, and the eval page is open to search crawls. */
export async function evalSamples(
  slug: string,
  offset = 0,
  order: SampleOrder = 'source',
  search = '',
): Promise<{ samples: EvalSampleItem[]; more: boolean; cleared: boolean }> {
  await limitRead('samples');
  const version = (await getEval(slug))?.versions[0];
  if (!version) return { samples: [], more: false, cleared: true };
  const access = await sampleAccess(version);
  const samples = await evalSampleList(
    version,
    access,
    offset,
    order === 'failed' || order === 'failedAsc' ? order : 'source',
    typeof search === 'string' ? search : '',
  );
  return { samples, more: samples.length === SAMPLE_PAGE, cleared: access.cleared };
}

/** One page of the newest version's samples from `offset`, with each detector's misses, as
 * `evalSamples`. `by`: a detector's score key, to put its most missed samples first, or `fewestOf`
 * the key, its fewest missed first; or a list of these, added up. `only`: one
 * detector's key, so that the totals count only its misses. `split`: only the samples of this split. */
export async function detectorSamples(
  slug: string,
  offset = 0,
  by?: string | string[],
  model?: string,
  only?: string,
  metric?: string,
  split?: string,
): Promise<{ samples: DetectorSampleItem[]; more: boolean; cleared: boolean }> {
  await limitRead('detector-samples');
  const version = (await getEval(slug))?.versions[0];
  if (!version) return { samples: [], more: false, cleared: true };
  const variants = new Set((await variantMethods(version.id)).keys());
  const [access, { keys, kind }] = await Promise.all([
    sampleAccess(version),
    detectorKeys(version.id, version.scores, variants),
  ]);
  const sort =
    typeof by === 'string'
      ? by
      : Array.isArray(by)
        ? by.filter((b): b is string => typeof b === 'string').slice(0, keys.length)
        : undefined;
  const def = version.metrics.find((m) => m.key === metric && !m.headline);
  const samples = await detectorSampleList(
    version,
    access,
    typeof only === 'string' ? keys.filter((k) => k === only) : keys,
    offset,
    sort,
    kind,
    typeof model === 'string' ? model : undefined,
    def && { key: def.key, lower: def.direction === 'lower_is_better' },
    typeof split === 'string' ? split : undefined,
  );
  return { samples, more: samples.length === SAMPLE_PAGE, cleared: access.cleared };
}
