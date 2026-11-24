import { prisma } from '@/lib/db';
import type { Model } from '@openaudit/spec';

// Which of some models have a system card and which have an OpenAudit, in two queries.
// A system card covers a model by id or by one of the model's documents, as in `cardsForModel`.

export async function modelCardFlags(models: Pick<Model, 'id' | 'documentIds'>[]) {
  const ids = models.map((m) => m.id);
  const docIds = [...new Set(models.flatMap((m) => m.documentIds))];
  const [systemCards, openAuditCards] = await Promise.all([
    prisma.systemCard.findMany({
      where: {
        document: { kind: 'system_card' },
        OR: [{ modelIds: { hasSome: ids } }, { documentId: { in: docIds } }, { alsoDocumentIds: { hasSome: docIds } }],
      },
      select: { modelIds: true, documentId: true, alsoDocumentIds: true },
    }),
    prisma.openAuditCard.findMany({
      where: { modelId: { in: ids }, versions: { some: { status: 'published' } } },
      select: { modelId: true },
    }),
  ]);
  const withOpenAudit = new Set(openAuditCards.map((c) => c.modelId));
  return new Map(
    models.map((m) => {
      const docs = new Set(m.documentIds);
      const systemCard = systemCards.some(
        (c) => c.modelIds.includes(m.id) || docs.has(c.documentId) || c.alsoDocumentIds.some((d) => docs.has(d)),
      );
      return [m.id, { systemCard, openAuditCard: withOpenAudit.has(m.id) }];
    }),
  );
}
