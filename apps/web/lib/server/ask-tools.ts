import { compact } from '@/lib/compact-json';
import { isSystemCardPath } from '@/lib/model-mode';
import { cardData, evalData, modelData, organizationData, searchCatalog, systemCardData } from '@/lib/server/ask-data';
import { tool } from 'ai';
import { z } from 'zod';

// The chat helper's catalog lookups. Each returns compact JSON text, or a line that says why not.

const path = z.string().describe('The page path from the data, for example "/anthropic/claude-opus-5.5"');

/** "/owner/repo[/...]" as its parts, without empty ones. */
function parts(p: string) {
  return p.split('?')[0].split('/').filter(Boolean);
}

const found = (data: unknown, what: string) => (data ? compact(data) : `No ${what} at that path.`);

export const ASK_TOOLS = {
  search_catalog: tool({
    description:
      'Find models, system cards, evals, organizations, safety methods and their variants, safety commitments and incidents whose names contain the query. Use a short name, for example "opus 5", "agentharm", "probe" or "pause". Returns page paths.',
    inputSchema: z.object({ query: z.string().min(1).max(100) }),
    execute: async ({ query }) => {
      const hits = await searchCatalog(query);
      return Object.values(hits).some((list) => list.length)
        ? compact(hits)
        : 'Nothing in the catalog has that name. Try a shorter or different name.';
    },
  }),
  get_model: tool({
    description:
      'A model: its facts, its Deploymeter score with the score of each judge, the headline result of our newest run of each evaluation, its variants, and its system cards with their findings.',
    inputSchema: z.object({ path }),
    execute: async ({ path: p }) => {
      const [owner, repo] = parts(p);
      return owner && repo ? found(await modelData(owner, repo), 'model') : 'Give a model path: /<owner>/<repo>.';
    },
  }),
  get_system_card: tool({
    description:
      'All data from a system card or report: findings, framework verdicts, topic summaries, external testers, specifications and evaluation results, with page numbers. "/<owner>/<repo>?tab=system-card" gives all of a model\u2019s system cards as one.',
    inputSchema: z.object({
      path: path.describe(
        'A path: "/<owner>/<repo>?tab=system-card", "/<owner>/<repo>/cards/<document key>" or "/<owner>/<repo>/reports/<document key>"',
      ),
    }),
    execute: async ({ path: p }) => {
      const [owner, repo, dir, key] = parts(p);
      if (owner && repo && (dir === 'system-card' || (!dir && isSystemCardPath(p))))
        return found(await systemCardData(owner, repo), 'model');
      if (!owner || !repo || (dir !== 'cards' && dir !== 'reports') || !key)
        return 'Give a path: /<owner>/<repo>?tab=system-card, or /<owner>/<repo>/cards/<document key>.';
      let documentKey = key;
      try {
        documentKey = decodeURIComponent(key);
      } catch {}
      return found(await cardData(owner, repo, documentKey), 'summary');
    },
  }),
  get_eval: tool({
    description:
      "An evaluation: its description, metrics, our newest run on each model with its results (openAuditRuns), and the results that labs' documents report (documentResults).",
    inputSchema: z.object({ path: path.describe('An eval path: "/evaluations/<slug>"') }),
    execute: async ({ path: p }) => {
      const [evals, slug] = parts(p);
      return (evals === 'evaluations' || evals === 'evals') && slug
        ? found(await evalData(slug), 'eval')
        : 'Give an eval path: /evaluations/<slug>.';
    },
  }),
  get_organization: tool({
    description:
      'An organization (lab or company): its safety commitments with their points, its incidents, its departures, its models and its documents.',
    inputSchema: z.object({ path: path.describe('An organization path: "/<slug>", for example "/openai"') }),
    execute: async ({ path: p }) => {
      const [slug, more] = parts(p);
      return slug && !more
        ? found(await organizationData(slug), 'organization')
        : 'Give an organization path: /<slug>.';
    },
  }),
};
