import { TOPIC_INFO, TOPIC_LABELS, Tag } from '@/components/catalog/parts';
import Link from '@/components/link';
import { AccessTag } from '@/components/methods/subject-board';
import { Empty, Page, PageHeader } from '@/components/page';
import { Section } from '@/components/section';
import { formatValue, variantPath } from '@/lib/methods';
import { COVERAGE_LABELS, type Tone } from '@/lib/openaudit-card';
import { getTopic, type ToolEval, type TopicCard } from '@/lib/server/topics';
import { topicFromSlug } from '@/lib/topics';
import { cn } from '@/lib/utils';
import type { Topic } from '@openaudit/spec';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ topic: string }> };

const TOPICS = Object.keys(TOPIC_LABELS) as Topic[];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = topicFromSlug((await params).topic, TOPICS);
  return topic ? { title: TOPIC_LABELS[topic], description: TOPIC_INFO[topic] } : { title: 'Topic' };
}

export const dynamic = 'force-dynamic';

export default async function TopicPage({ params }: Props) {
  const topic = topicFromSlug((await params).topic, TOPICS);
  if (!topic) notFound();
  const { ofModels, ofTools, cards } = await getTopic(topic);
  return (
    <Page>
      <PageHeader eyebrow="Topic" title={TOPIC_LABELS[topic]} description={TOPIC_INFO[topic]} />
      <Section
        title="Evals of models"
        info="Evals that test how the models act on this topic. Each model's OpenAudit sums up its results."
      >
        {ofModels.length === 0 ? (
          <Empty>No evals of models on this topic yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ofModels.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/evaluations/${e.slug}`} className="font-medium text-sky-800 hover:underline">
                    {e.displayName}
                  </Link>
                  {e.results > 0 && <span className="shrink-0 text-xs text-slate-500">{e.results} results</span>}
                </div>
                {(e.summary ?? e.description) && (
                  <p className="line-clamp-2 text-sm text-slate-600">{e.summary ?? e.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {cards.length > 0 && <Cards cards={cards} />}
      </Section>
      <Section
        title="Evals of methods and auditors"
        info="Evals that test what checks models: methods such as probes and monitors, and auditing agents. They must find the behavior when it is present."
      >
        {ofTools.length === 0 ? (
          <Empty>No evals of methods or auditors on this topic yet.</Empty>
        ) : (
          ofTools.map((t) => <ToolBoard key={t.eval.id} tool={t} />)
        )}
      </Section>
    </Page>
  );
}

const TONE: Record<Tone, [string, string]> = {
  good: ['bg-emerald-600', 'Good for safety'],
  mixed: ['bg-orange-500', 'Mixed or a mild concern'],
  bad: ['bg-red-600', 'A clear concern'],
  neutral: ['bg-slate-300', 'Neutral'],
};

function Cards({ cards }: { cards: TopicCard[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">Model</th>
            <th className="px-2 py-2 font-medium">Coverage</th>
            <th className="px-3 py-2 font-medium">What its OpenAudit says</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cards.map((c) => (
            <tr key={c.model.name} className="align-top">
              <td className="px-3 py-1.5 whitespace-nowrap">
                <Link href={c.model.href} className="text-slate-800 hover:underline">
                  {c.model.displayName}
                </Link>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                  {c.tone && (
                    <span
                      role="img"
                      aria-label={TONE[c.tone][1]}
                      title={TONE[c.tone][1]}
                      className={cn('size-2 shrink-0 rounded-full', TONE[c.tone][0])}
                    />
                  )}
                  {COVERAGE_LABELS[c.coverage]}
                </span>
              </td>
              <td className="px-3 py-1.5 text-slate-600">
                {c.summary ? <span className="line-clamp-2">{c.summary}</span> : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One eval of methods or auditors: each variant's median over the models, best first. */
function ToolBoard({ tool: t }: { tool: ToolEval }) {
  const href = `/evaluations/${t.eval.slug}`;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={href} className="font-medium text-sky-800 hover:underline">
          {t.eval.displayName}
        </Link>
        {t.metric && t.models > 0 && (
          <span className="text-xs text-slate-500">
            Median {t.metric.displayName.toLowerCase()} over {t.models} models
          </span>
        )}
      </div>
      {t.eval.summary && <p className="text-sm text-slate-600">{t.eval.summary}</p>}
      {t.medians.length === 0 ? (
        <p className="text-sm text-slate-500">
          No ranking yet.{' '}
          <Link href={href} className="text-sky-800 hover:underline">
            See the eval
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="w-8 px-3 py-2 text-right font-medium">#</th>
                <th className="px-2 py-2 font-medium">Variant</th>
                <th className="px-2 py-2 font-medium">Access</th>
                <th className="px-2 py-2 text-right font-medium">Median</th>
                <th className="px-3 py-2 text-right font-medium">Models</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {t.medians.map((m, i) => (
                <tr key={m.variant.id} className={cn(i === 0 && 'bg-emerald-50')}>
                  <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      href={variantPath(m.variant.method.slug, m.variant.slug)}
                      className={cn('hover:underline', i === 0 ? 'font-semibold text-emerald-900' : 'text-slate-800')}
                    >
                      {m.variant.displayName}
                    </Link>
                    {m.variant.baseline && <Tag className="ml-1.5">baseline</Tag>}
                  </td>
                  <td className="px-2 py-1.5">
                    <AccessTag access={m.variant.access} />
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatValue(m.median)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-500 tabular-nums">{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
