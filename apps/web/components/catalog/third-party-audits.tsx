import Link from '@/components/link';
import { Section } from '@/components/section';
import { prisma } from '@/lib/db';
import { DOCUMENT_KINDS } from '@/lib/format';
import { organizationPath } from '@/lib/organizations';
import { cardPath, type CardView } from '@/lib/server/catalog';
import type { Model } from '@openaudit/spec';

const ABOUT =
  'Reports by independent organizations that tested this model, for example a government AI safety institute. They are not by the developer, so we trust them more than its own claims. The Deploymeter judges read them.';

/** Cards on documents that the model's developer did not publish. */
export function thirdPartyCards(cards: CardView[], developers: string[]) {
  return cards.filter((c) => !developers.includes(c.document.publisherId));
}

/** The model page's list of third-party reports. Shows nothing when there are none. */
export async function ThirdPartyAudits({ cards, model }: { cards: CardView[]; model: Pick<Model, 'name'> }) {
  if (!cards.length) return null;
  const publishers = await prisma.organization.findMany({
    where: { id: { in: [...new Set(cards.map((c) => c.document.publisherId))] } },
    select: { id: true, slug: true, displayName: true },
  });
  const byId = new Map(publishers.map((p) => [p.id, p]));
  return (
    <Section id="third-party-audits" title="Third-Party Audits" info={ABOUT}>
      <ul className="flex flex-col gap-y-2">
        {cards.map((c) => {
          const publisher = byId.get(c.document.publisherId);
          return (
            <li key={c.id} className="flex flex-col gap-y-0.5 rounded-lg border border-slate-200 bg-white px-4 py-3">
              <Link
                href={cardPath(model, c.document.key, c.document.kind)}
                className="text-sm font-semibold text-slate-800 hover:text-sky-800 hover:underline"
              >
                {c.document.title}
              </Link>
              <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
                {publisher && (
                  <Link href={organizationPath(publisher)} className="font-medium text-sky-800 hover:underline">
                    {publisher.displayName}
                  </Link>
                )}
                <span aria-hidden>·</span>
                <span>{DOCUMENT_KINDS[c.document.kind]}</span>
                <span aria-hidden>·</span>
                <span>{c.document.publishedDate ?? 'Undated'}</span>
                {c.resultCount > 0 && (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      {c.resultCount} {c.resultCount === 1 ? 'result' : 'results'}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
