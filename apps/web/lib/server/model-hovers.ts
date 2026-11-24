import { prisma } from '@/lib/db';
import { votesOf, type DeployVotes } from '@/lib/deploymeter';
import { modelPathOf } from '@/lib/model-links';
import { modelEvalCounts, modelPath } from '@/lib/server/catalog';
import { ttlCache } from '@/lib/server/ttl-cache';

/** What the hover card of a model link shows (`components/model-link.tsx`). `released`: the
 * release date (`YYYY-MM-DD`, or less). `meter` and `votes`: its Deploymeter. `flagged` and
 * `evals`: as `modelEvalCounts` (`flagged` and `openAudit`). Empty fields are left out, as most
 * models have none. */
export type ModelHover = {
  name: string;
  developer: string;
  released?: string;
  meter?: number;
  votes?: DeployVotes;
  flagged?: number;
  evals?: number;
};

/** The hover cards of all models of shown organizations, by `modelPathOf` their path. */
export const modelHovers = ttlCache(async (): Promise<Record<string, ModelHover>> => {
  const [rows, counts] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; label: string; developer: string; released: string | null }[]>`
      SELECT m.id, m.name, m."displayName" AS label, o."displayName" AS developer,
        CASE WHEN jsonb_typeof(m.facts #> '{releaseDate,value}') = 'string'
          THEN m.facts #>> '{releaseDate,value}' END AS released
      FROM model m JOIN organization o ON o.id = m."organizationId" AND NOT o.hidden
      WHERE NOT m.hidden`,
    modelEvalCounts(),
  ]);
  return Object.fromEntries(
    rows.flatMap((r) => {
      const key = modelPathOf(modelPath(r));
      const judges = counts.judges.get(r.id);
      const hover: ModelHover = {
        name: r.label,
        developer: r.developer,
        released: r.released || undefined,
        meter: counts.deploymeter.get(r.id),
        votes: judges && votesOf(judges),
        flagged: counts.flagged.get(r.id) || undefined,
        evals: counts.openAudit.get(r.id) || undefined,
      };
      return key ? [[key, hover]] : [];
    }),
  );
}, 300_000);
