// Queues a model's recommended evals that have no run yet, as a moderator's "Queue Run" on the model
// page does: the same evals, the model's default thinking effort and the same checks. The runs have
// no owner, so no emails go out. Dry run by default: it prints each run, its cost and its time.
//
// The Worker starts at most 20 containers, and drops a message that cannot start after 100 tries.
// So the script sends only runs that fit in `--containers` (default 16). `--resend` sends the
// model's queued runs that have not started, in the same way. A second send starts no new container.
//
//   pnpm exec node scripts/with-env.mjs tsx scripts/queue-model-evals.ts <model name> [--apply | --resend] [--containers N]
import type { StartRunInput } from '@/app/runs/actions';
import { prisma } from '@/lib/db';
import { newId } from '@/lib/ids';
import { isMissing } from '@/lib/runs/eval-table';
import { effortsFor, routeFor } from '@/lib/runs/model-routes';
import { estimateRuns } from '@/lib/server/estimates';
import { evalRows } from '@/lib/server/eval-table';
import { busyRuns, priceItems, repeatRuns } from '@/lib/server/run-checks';
import { containersFor, enqueueRun } from '@/lib/server/run-queue';
import { evalRunToRow } from '@/lib/spec/rows';
import type { EvalRun } from '@openaudit/spec';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const resend = args.includes('--resend');
const flag = args.indexOf('--containers');
let budget = flag >= 0 ? Number(args[flag + 1]) : 16;
const name = args.find((a, i) => !a.startsWith('--') && (flag < 0 || i !== flag + 1));

/** Sends the run to the queue if its containers fit in the budget. */
async function send(id: string, limit: number | undefined, slug: string) {
  const n = containersFor(limit);
  if (n > budget) {
    console.log(`    ${slug}: queued, not sent. Send it later with --resend.`);
    return;
  }
  if (await enqueueRun(id, n)) budget -= n;
  else console.log(`    ${slug}: run ${id} is in the database but not in the queue`);
}

async function main() {
  if (!name || !Number.isInteger(budget) || budget < 1)
    throw new Error('Usage: queue-model-evals.ts <model name> [--apply | --resend] [--containers N]');
  const model = await prisma.model.findFirst({
    where: { name },
    select: { id: true, name: true, source: true, organization: { select: { slug: true } } },
  });
  if (!model) throw new Error(`No model ${name} in the database. Import the seed first.`);
  if (resend) {
    const waiting = await prisma.evalRun.findMany({
      where: { modelId: model.id, origin: 'run', status: 'queued', shards: { none: {} } },
      select: { id: true, settings: true, eval: { select: { slug: true } } },
      orderBy: { createdAt: 'asc' },
    });
    console.log(`${waiting.length} queued runs have not started.`);
    for (const r of waiting) {
      const before = budget;
      await send(r.id, (r.settings as { limit?: number }).limit, r.eval.slug);
      if (budget < before) console.log(`  sent ${r.eval.slug}`);
    }
    return;
  }
  const route = await routeFor({ name: model.name, source: model.source, organization: model.organization.slug });
  if (!route) throw new Error(`No route for ${name}. Check it with pnpm routes:check.`);
  const effort = (await effortsFor(route)).default;

  const rows = (await evalRows(model.id, effort, false)).filter(
    (r) => r.status === 'active' && !(r.rawReasoning && model.source === 'api') && isMissing(r.state),
  );
  const inputs: StartRunInput[] = rows.map((r) => ({ modelId: model.id, evalId: r.evalId, reasoning: effort }));
  const priced = await priceItems(inputs);
  const ok = priced.flatMap((p) => (p.ok ? [p] : []));
  const [busy, ran, seconds] = await Promise.all([
    busyRuns(ok.map((p) => p.request)),
    repeatRuns(
      ok.map((p) => p.request),
      { succeededOnly: true },
    ),
    estimateRuns(
      ok.map(({ request: r, quote }) => ({
        evalId: r.evalId,
        evalVersionId: r.versionId,
        settings: r.settings,
        samples: quote.samples,
      })),
    ),
  ]);

  console.log(`${model.name} via ${route.model}, thinking effort ${effort}. ${rows.length} evals have no run.`);
  let total = 0;
  for (const [i, p] of priced.entries()) {
    const slug = rows[i].slug;
    if (!p.ok) {
      console.log(`  skip ${slug}: ${p.error}`);
      continue;
    }
    const j = ok.indexOf(p);
    const hours = seconds[j] === null ? '?' : (seconds[j]! / 3600).toFixed(1);
    const why = busy[j] ? `already ${busy[j]!.status}` : ran[j] ? 'already ran' : null;
    console.log(
      `  ${why ? 'skip' : apply ? 'queue' : 'would queue'} ${slug}: ${p.quote.samples} samples, ` +
        `about $${p.quote.estCostUsd.toFixed(2)}, ${hours} h${why ? ` (${why})` : ''}`,
    );
    if (why) continue;
    total += p.quote.estCostUsd;
    if (!apply) continue;
    const { evalId, versionId, route: runRoute, settings } = p.request;
    const run: EvalRun = {
      id: newId(),
      evalId,
      evalVersionId: versionId,
      modelId: model.id,
      origin: 'run',
      status: 'queued',
      route: runRoute,
      settings,
      visibility: 'public',
      createdAt: new Date().toISOString(),
    };
    await prisma.evalRun.create({ data: { ...evalRunToRow(run), ownerUserId: null } });
    await send(run.id, settings.limit, slug);
  }
  console.log(`Total: about $${total.toFixed(2)}.${apply ? '' : ' Dry run. Add --apply to queue.'}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
