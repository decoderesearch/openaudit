import { commitmentPath } from '@/lib/commitments';
import { prisma } from '@/lib/db';
import { NEXT_PUBLIC_URL } from '@/lib/env';
import { methodPath, suitePath, variantPath } from '@/lib/methods';
import { organizationPath } from '@/lib/organizations';
import { modelPath, SHOWN_MODEL, SHOWN_ORG } from '@/lib/server/catalog';
import { HIDDEN_TOPICS, TOPIC_LABELS, topicPath } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';
import type { MetadataRoute } from 'next';

export const dynamic = 'force-dynamic';

const PAGES = [
  '/',
  '/models',
  '/organizations',
  '/organizations/commitments',
  '/methods',
  '/topics',
  '/evaluations/known-errors',
  '/features',
  '/faqs',
  '/contribute',
  '/submit',
  '/terms',
  '/privacy',
];

/** The pages that the public sees. Run, attempt and sample pages are noindex, so they are not here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const PUBLIC = { visibility: 'public' };
  const [models, orgs, evals, methods, suites, commitments] = await Promise.all([
    prisma.model.findMany({ where: SHOWN_MODEL, select: { name: true, updatedAt: true } }),
    prisma.organization.findMany({ where: SHOWN_ORG, select: { slug: true, updatedAt: true } }),
    prisma.eval.findMany({ where: PUBLIC, select: { slug: true, updatedAt: true } }),
    prisma.method.findMany({
      where: { variants: { some: PUBLIC } },
      select: { slug: true, updatedAt: true, variants: { where: PUBLIC, select: { slug: true, updatedAt: true } } },
    }),
    prisma.evalSuite.findMany({ where: { evals: { some: PUBLIC } }, select: { slug: true, updatedAt: true } }),
    prisma.commitment.findMany({ select: { slug: true, updatedAt: true } }),
  ]);
  const topics = (Object.keys(TOPIC_LABELS) as Topic[]).filter((t) => !HIDDEN_TOPICS.includes(t));
  const entry = (path: string, lastModified?: Date) => ({ url: `${NEXT_PUBLIC_URL}${path}`, lastModified });
  return [
    ...PAGES.map((p) => entry(p)),
    ...topics.map((t) => entry(topicPath(t))),
    ...orgs.map((o) => entry(organizationPath(o), o.updatedAt)),
    ...models.map((m) => entry(modelPath(m), m.updatedAt)),
    ...evals.map((e) => entry(`/evaluations/${e.slug}`, e.updatedAt)),
    ...suites.map((s) => entry(suitePath(s.slug), s.updatedAt)),
    ...methods.flatMap((m) => [
      entry(methodPath(m.slug), m.updatedAt),
      ...m.variants.map((v) => entry(variantPath(m.slug, v.slug), v.updatedAt)),
    ]),
    ...commitments.map((c) => entry(commitmentPath(c.slug), c.updatedAt)),
  ];
}
