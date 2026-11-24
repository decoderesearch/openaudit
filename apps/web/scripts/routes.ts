// Prints how we reach seed models on OpenRouter. It uses the same rule as the site.
//
//   pnpm routes:check [model ids]       the routes, and the models with no route
//   pnpm routes:check --json <model id> one route as JSON, or null (the runner's enqueue reads it)
import { matchModel, pickRoute, routeFor, routeOverride, type RouteModel } from '@/lib/runs/model-routes';
import { QUOTE_MAX_AGE, openRouterEndpoints, openRouterModels } from '@/lib/runs/openrouter';
import type { ServingRoute } from '@openaudit/spec';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEED = fileURLToPath(new URL('../../../data/seed/system_cards.json', import.meta.url));

type SeedModel = { id: string; source: string; organizationId: string };
const seed = (JSON.parse(readFileSync(SEED, 'utf8')) as { models: SeedModel[] }).models;
const asRoute = (m: SeedModel): RouteModel => ({ name: m.id, source: m.source, organization: m.organizationId });

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const label = (r: ServingRoute) =>
  `${r.model} via ${r.providers?.join(', ') ?? 'any'} (${r.quantization ?? 'unknown'})`;

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--json') {
    const model = seed.find((m) => m.id === args[1]);
    if (!model) throw new Error(`${args[1]} is not a seed model.`);
    console.log(JSON.stringify(await routeFor(asRoute(model), QUOTE_MAX_AGE)));
    return;
  }

  const models = args.length ? seed.filter((m) => args.includes(m.id)) : seed;
  const missing = args.filter((a) => !seed.some((m) => m.id === a));
  if (missing.length) throw new Error(`Not seed models: ${missing.join(', ')}`);
  const listed = await openRouterModels(QUOTE_MAX_AGE);
  if (!listed) throw new Error('OpenRouter did not answer.');

  const rows = await mapLimit(models, 8, async (m) => {
    const override = routeOverride(m.id);
    if (override === null) return { m, line: null, note: 'blocked by route-overrides.json' };
    if (override && 'kind' in override) return { m, line: `${label(override)} [override]` };
    const orModel = override?.model ?? matchModel(asRoute(m), listed);
    if (!orModel) return { m, line: null, note: 'not on OpenRouter' };
    const route = pickRoute(asRoute(m), orModel, (await openRouterEndpoints(orModel, QUOTE_MAX_AGE)) ?? []);
    const tag = override ? ' [override]' : '';
    return route
      ? { m, line: `${label(route)}${tag}` }
      : { m, line: null, note: `${orModel}: no provider passes the rule` };
  });

  const routed = rows.filter((r) => r.line);
  for (const r of routed) console.log(`${r.m.id}: ${r.line}`);
  // With no model ids, models that are not on OpenRouter are too many to list.
  const unrouted = rows.filter((r) => !r.line && (args.length || r.note !== 'not on OpenRouter'));
  if (unrouted.length) console.log(`\nNo route:\n${unrouted.map((r) => `  ${r.m.id}: ${r.note}`).join('\n')}`);
  console.log(`\n${routed.length} of ${models.length} models have a route.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
