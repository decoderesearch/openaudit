import { TOPIC_INFO, TOPIC_LABELS } from '@/components/catalog/parts';
import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { topicCounts } from '@/lib/server/topics';
import { otherEvalCounts, topicPath } from '@/lib/topics';
import type { Topic } from '@openaudit/spec';

export const metadata = {
  title: 'Topics',
  description: 'Safety topics, with the evals that test models and the evals that test methods and auditors on each.',
};
export const dynamic = 'force-dynamic';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export default async function TopicsPage() {
  const counts = await topicCounts();
  const topics = (Object.keys(TOPIC_LABELS) as Topic[]).filter((t) => counts.has(t));
  return (
    <Page>
      <PageHeader
        title="Topics"
        description="Each topic has two halves: evals that test models, and evals that test the methods (probes, monitors) and auditors that check models."
      />
      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {topics.map((t) => {
          const c = counts.get(t)!;
          return (
            <li key={t}>
              <Link
                href={topicPath(t)}
                className="flex h-full flex-col gap-1 rounded-md border border-slate-200 bg-white p-3 hover:border-sky-300 hover:bg-sky-50/40"
              >
                <span className="font-medium text-slate-800">{TOPIC_LABELS[t]}</span>
                <span className="text-sm text-slate-600">{TOPIC_INFO[t]}</span>
                <span className="text-xs text-slate-500">
                  {[plural(c.models, 'model eval'), otherEvalCounts(c)].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Page>
  );
}
