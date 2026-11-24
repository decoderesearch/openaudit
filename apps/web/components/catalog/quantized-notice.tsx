import Link from '@/components/link';
import type { Model, SystemCard } from '@openaudit/spec';

type Notice = {
  model: Pick<Model, 'id'>;
  /** The original model, and the path of its page. */
  parent: { displayName: string; href: string };
  /** The system cards on the page. A card is the copy's own only if it covers the copy. */
  systemCards: Pick<SystemCard, 'covers'>[];
  /** The copy has an OpenAudit. */
  audited: boolean;
};

const cardsOf = (n: number) => (n === 1 ? 'system card' : 'system cards');

/** What a quantized copy's page is about: the model we evaluated, and whose system cards it shows. */
export function QuantizedNotice({ model, parent, systemCards, audited }: Notice) {
  const own = systemCards.filter((c) => c.covers.some((x) => x.modelId === model.id)).length;
  const base = systemCards.length - own;
  const sentences = [
    own
      ? '.'
      : base
        ? ` and has no system card of its own. The ${cardsOf(base)} on this page ${base === 1 ? 'is' : 'are'} for the original model.`
        : ' and has no system card.',
    own && base ? ` This page also shows the ${cardsOf(base)} of the original model.` : '',
    audited ? ' We evaluated this model directly, not the original model.' : '',
    audited && base
      ? own
        ? ' We compare our results with the system cards of both models.'
        : ` We compare our results with the ${cardsOf(base)} of the original model.`
      : '',
  ];
  return (
    <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
      This model is a quantized copy of{' '}
      <Link href={parent.href} className="font-medium underline">
        {parent.displayName}
      </Link>
      {sentences.join('')}
    </p>
  );
}
