import { prisma } from '@/lib/db';
import { organizationPath } from '@/lib/organizations';
import { modelPath } from '@/lib/server/catalog';

/** Each organization for the admin page, hidden first, then by name: its model count and the
 * models with a published OpenAudit. */
export async function adminOrganizations() {
  const orgs = await prisma.organization.findMany({
    orderBy: [{ hidden: 'desc' }, { displayName: 'asc' }],
    select: {
      id: true,
      slug: true,
      displayName: true,
      hidden: true,
      _count: { select: { models: true } },
      models: {
        where: { openAuditCard: { versions: { some: { status: 'published' } } } },
        select: { displayName: true },
        orderBy: { displayName: 'asc' },
      },
    },
  });
  return orgs.map(({ _count, models, ...o }) => ({
    ...o,
    href: organizationPath(o),
    models: _count.models,
    published: models.map((m) => m.displayName),
  }));
}

/** Hides the organization and its models from the public, or shows them. False: no such id. */
export async function setOrganizationHidden(id: string, hidden: boolean): Promise<boolean> {
  const { count } = await prisma.organization.updateMany({ where: { id }, data: { hidden } });
  return count > 0;
}

/** The hidden models, by name, for the admin page. */
export async function adminHiddenModels() {
  const rows = await prisma.model.findMany({
    where: { hidden: true },
    select: { id: true, name: true, displayName: true, organization: { select: { displayName: true } } },
    orderBy: { name: 'asc' },
  });
  return rows.map((m) => ({ ...m, href: modelPath(m) }));
}

/** True when an admin hid the model itself (not its organization). */
export async function isModelHiddenFlag(id: string): Promise<boolean> {
  return !!(await prisma.model.findUnique({ where: { id }, select: { hidden: true } }))?.hidden;
}

/** Hides the model, its page and its runs from the public, or shows them. Then the sample stats
 * of the eval versions with its public runs count again. False: no such id. */
export async function setModelHidden(id: string, hidden: boolean): Promise<boolean> {
  const { count } = await prisma.model.updateMany({ where: { id }, data: { hidden } });
  if (!count) return false;
  const versions = await prisma.evalRun.findMany({
    where: { modelId: id, visibility: 'public' },
    distinct: ['evalVersionId'],
    select: { evalVersionId: true },
  });
  for (const v of versions) await prisma.$queryRaw`SELECT refresh_sample_stats(${v.evalVersionId}::uuid)`;
  return true;
}
