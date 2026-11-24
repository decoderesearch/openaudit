import { prisma } from '@/lib/db';
import { LISTED_MODEL } from '@/lib/server/catalog';
import { ttlCache } from '@/lib/server/ttl-cache';

/** Counts for the home columns and the menus' buttons. `methods` counts each variant too. */
export type HomeCounts = { models: number; organizations: number; commitments: number; methods: number };

/** The totals we show: the listed models, the organizations we have (hidden ones aside), the
 * organization–commitment pairs, and the methods with their public variants. */
export const homeCounts = ttlCache(async (): Promise<HomeCounts> => {
  const [models, organizations, commitments, methods, variants] = await Promise.all([
    prisma.model.count({ where: LISTED_MODEL }),
    prisma.organization.count({ where: { hidden: false } }),
    prisma.orgCommitment.count(),
    prisma.method.count(),
    prisma.methodVariant.count({ where: { baseline: false, visibility: 'public' } }),
  ]);
  return { models, organizations, commitments, methods: methods + variants };
}, 300_000);
