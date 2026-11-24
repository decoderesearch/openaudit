import { clientIp } from '@/lib/rate-limit';
import { getEval } from '@/lib/server/catalog';
import { allow, tooMany } from '@/lib/server/limits';
import { mostFailedSamples, samplePath } from '@/lib/server/runs';

// An eval's most failed samples as JSON, for agents that look for errors in the eval: the IDs and
// counts of the eval page's list, with no sample text. Sample text is eval content (/terms#ai-training).

type Context = { params: Promise<{ slug: string }> };

const LIMIT = 100;
const MAX = 500;

export async function GET(request: Request, { params }: Context) {
  if (!(await allow('general', 'failed-samples', clientIp(request.headers)))) return tooMany();
  const { slug } = await params;
  const found = await getEval(slug);
  const version = found?.versions[0];
  if (!found || !version) return Response.json({ error: 'Not found' }, { status: 404 });
  const url = new URL(request.url);
  const n = Number(url.searchParams.get('limit'));
  const rows = await mostFailedSamples(version.id, Number.isInteger(n) && n > 0 ? Math.min(n, MAX) : LIMIT);
  return Response.json(
    {
      eval: {
        slug,
        name: found.eval.displayName,
        version: version.version,
        url: new URL(`/evaluations/${slug}`, url).href,
      },
      dataset: version.dataset ?? null,
      about: `"failed" counts the graded replies that failed, one for each model and epoch, from the newest public run of each model. What a failed reply means depends on the eval. Sample text is not here: get it from the dataset, by sourceId. At most ${MAX} samples (?limit=).`,
      samples: rows.map((r) => ({
        split: r.split,
        sourceId: r.sourceId,
        failed: r.failed,
        graded: r.graded,
        url: new URL(samplePath(r), url).href,
      })),
    },
    { headers: { 'cache-control': 'public, max-age=3600', 'x-robots-tag': 'noindex' } },
  );
}
