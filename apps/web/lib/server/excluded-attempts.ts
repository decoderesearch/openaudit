import { Prisma } from '#prisma';
import { prisma } from '@/lib/db';

// Flagged chats on a sample with a confirmed known error (EVAL_KNOWN_ERRORS.md) that excludes it
// do not show or count. A card keeps them, so they show again when the issue closes.

/** SQL: true when `attempt` (an attempt id column) is of an excluded sample. */
export const excludedAttempt = (attempt: Prisma.Sql) =>
  Prisma.sql`EXISTS (SELECT 1 FROM eval_attempt xa JOIN eval_sample_issue xi ON xi."evalSampleId" = xa."evalSampleId"
    WHERE xa.id = ${attempt} AND xi.status = 'confirmed' AND xi.effect = 'exclude')`;

/** Of `ids`, the attempts of excluded samples. */
export async function excludedAttempts(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT a.id::text AS id FROM eval_attempt a JOIN eval_sample_issue i ON i."evalSampleId" = a."evalSampleId"
    WHERE a.id = ANY(${[...new Set(ids)]}::uuid[]) AND i.status = 'confirmed' AND i.effect = 'exclude'`;
  return new Set(rows.map((r) => r.id));
}
