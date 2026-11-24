import { prisma } from '@/lib/db';
import { sampleRef, type SampleRef } from '@/lib/sample-label';

/** A getter of each attempt's `SampleRef`, by attempt id. Snippets have no relation to their
 * attempt. A missing attempt gets the id "?". */
export async function sampleRefs(attemptIds: string[]): Promise<(attemptId: string) => SampleRef> {
  const rows = attemptIds.length
    ? await prisma.evalAttempt.findMany({
        where: { id: { in: [...new Set(attemptIds)] } },
        select: { id: true, sampleId: true, epoch: true, run: { select: { settings: true } } },
      })
    : [];
  const refs = new Map(rows.map((a) => [a.id, sampleRef(a, (a.run.settings as { epochs?: unknown } | null)?.epochs)]));
  return (id) => refs.get(id) ?? { id: '?' };
}
