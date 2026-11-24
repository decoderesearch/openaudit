import { ModelFeed } from '@/components/catalog/model-feed';
import { MODEL_SORTS, sortOf } from '@/lib/home-sorts';
import { orgModelsPath } from '@/lib/org-research';
import { auditEstimate, roundUsd } from '@/lib/server/audit-estimate';
import { findOrganization, getOrganization, isHiddenOrganization, modelPath } from '@/lib/server/catalog';
import { evalsTooOldFor } from '@/lib/server/eval-age';
import { snippetFeedFor, unauditedModels } from '@/lib/server/snippet-feed';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';

type Props = { params: Promise<{ owner: string }>; searchParams: Promise<Record<string, unknown>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const found = await findOrganization((await params).owner);
  if (!found || ((await isHiddenOrganization(found.org.id)) && !isAdmin(await getViewer()))) return { title: 'Models' };
  return { title: `${found.org.displayName} Models`, alternates: { canonical: orgModelsPath(found.org) } };
}

/** The organization's audited models as on the Models page, then its other listed models with the
 * cost of an audit. */
export default async function OrganizationPage({ params, searchParams }: Props) {
  const named = await findOrganization((await params).owner);
  if (!named) notFound();
  if (named.redirect) permanentRedirect(orgModelsPath(named.org));
  if ((await isHiddenOrganization(named.org.id)) && !isAdmin(await getViewer())) notFound();
  const { sort } = await searchParams;
  const [found, entries, others] = await Promise.all([
    getOrganization(named.org.slug),
    snippetFeedFor(named.org.slug).catch(() => []),
    unauditedModels(named.org.slug),
  ]);
  if (!found) notFound();
  const tooOld = await evalsTooOldFor(others);
  const o = found.organization;

  // Not awaited: each estimate reads the model's evals and prices, so the rows show first.
  const costs = Promise.all(
    others.map(async (m) => {
      const e = await auditEstimate({ id: m.id, name: m.name, source: m.source, organization: o.slug }).catch(
        () => null,
      );
      return [m.id, e && roundUsd(e.totalUsd)] as const;
    }),
  ).then(Object.fromEntries);

  return (
    <ModelFeed
      entries={entries}
      initial={sortOf(MODEL_SORTS, typeof sort === 'string' ? sort : null)}
      title="Models"
      noOrg
      unaudited={others.map((m, i) => ({
        key: m.id,
        label: m.displayName,
        href: modelPath(m),
        evalsTooOld: tooOld[i],
      }))}
      costs={costs}
      className="lg:h-full"
    />
  );
}
