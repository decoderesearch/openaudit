import { organizationPath } from '@/lib/organizations';
import { listModels, modelPath } from '@/lib/server/catalog';
import { evalsTooOldFor } from '@/lib/server/eval-age';
import { modelUpdates } from '@/lib/server/model-feed';
import type { SnippetFeedEntry } from '@/lib/server/snippet-feed';
import { ttlCache } from '@/lib/server/ttl-cache';

/** A listed model with no OpenAudit card. `date`: its release date. `evalsTooOld`: see `evalsTooOld`. */
export type OtherModel = {
  key: string;
  label: string;
  href: string;
  date: string | null;
  org: { label: string; href: string };
  evalsTooOld: boolean;
};

/** All the models of the lists: those with an OpenAudit card (the newest card first, with the first
 * chats of each group), then the others, the newest release first. The lists get all at one time,
 * then sort, search and show more with no load. */
export type AllModels = { cards: SnippetFeedEntry[]; others: OtherModel[] };

/** The listed models with no OpenAudit card, the newest release first. */
export const otherModels = ttlCache(async (): Promise<OtherModel[]> => {
  const [models, cards] = await Promise.all([listModels({}), modelUpdates()]);
  const carded = new Set(cards.map((c) => c.href));
  const others = models.filter((m) => !carded.has(modelPath(m)));
  const tooOld = await evalsTooOldFor(others);
  return others.map((m, i) => ({
    key: m.id,
    label: m.displayName,
    href: modelPath(m),
    date: m.facts.releaseDate?.value ?? null,
    org: { label: m.organization.displayName, href: organizationPath(m.organization) },
    evalsTooOld: tooOld[i]!,
  }));
}, 300_000, 'other-models');

export async function allModels(): Promise<AllModels> {
  const [cards, others] = await Promise.all([modelUpdates(), otherModels()]);
  return { cards, others };
}
