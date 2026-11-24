import { ModelFeed } from '@/components/catalog/model-feed';
import type { ModelSort } from '@/lib/home-sorts';
import { allModels } from '@/lib/server/home-models';

/** The Models page's updates feed: all its models from the server, first in `sort` order, then the
 * models with no OpenAudit card. */
export async function ModelUpdates({ sort, className }: { sort: ModelSort; className?: string }) {
  const { cards, others } = await allModels().catch(() => ({ cards: [], others: [] }));
  return <ModelFeed entries={cards} unaudited={others} initial={sort} note className={className} />;
}
