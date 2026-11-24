// Writes lib/server/price-baselines.json: the succeeded runs in this database, as pricing reads
// them. A site uses them as past runs for an eval that has no runs of its own there.
//
//   node scripts/with-env.mjs tsx scripts/price-baselines.ts
import { PrismaClient } from '#prisma';
import { pastRunFromRow, type PastRun } from '@/lib/server/pricing';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../lib/server/price-baselines.json', import.meta.url));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const rows = await prisma.evalRun.findMany({
    where: { origin: 'run', status: 'succeeded', attemptCount: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
    select: {
      route: true,
      settings: true,
      provenance: true,
      attemptCount: true,
      sampleCount: true,
      eval: { select: { slug: true } },
      evalVersion: { select: { version: true } },
    },
  });
  // By slug and version: each database gives the same eval its own id.
  const bySlug: Record<string, Record<string, PastRun[]>> = {};
  for (const row of rows) {
    const run = pastRunFromRow(row);
    if (run.costUsd || run.byModel) ((bySlug[row.eval.slug] ??= {})[row.evalVersion.version] ??= []).push(run);
  }
  const sorted = Object.fromEntries(Object.entries(bySlug).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);
  const runs = Object.values(sorted).reduce((n, v) => n + Object.values(v).flat().length, 0);
  console.log(`Wrote ${runs} runs for ${Object.keys(sorted).length} evals to ${OUT}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
