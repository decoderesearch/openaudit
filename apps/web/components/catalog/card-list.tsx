import { ReviewBadge } from '@/components/catalog/parts';
import Link from '@/components/link';
import { DOCUMENT_KINDS } from '@/lib/format';
import { cardPath, type CardView } from '@/lib/server/catalog';
import type { Model } from '@openaudit/spec';

/** Our summaries of a model's documents, each a link to its page. */
export function CardList({ cards, model }: { cards: CardView[]; model: Model }) {
  if (!cards.length) return <p className="text-sm text-slate-500">No summaries yet.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {cards.map((c) => (
        <li key={c.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={cardPath(model, c.document.key, c.document.kind)}
              className="text-sm font-medium text-sky-800 hover:underline"
            >
              {c.document.title}
            </Link>
            <ReviewBadge reviewed={c.reviewed} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {DOCUMENT_KINDS[c.document.kind]} · {c.document.publishedDate ?? 'Undated'} · {c.riskDecisions.length}{' '}
            framework verdicts · {c.topics.filter((t) => t.covered).length} of {c.topics.length} topics covered ·{' '}
            {c.testers.length} external testers · {c.resultCount} reported results
          </p>
        </li>
      ))}
    </ul>
  );
}
