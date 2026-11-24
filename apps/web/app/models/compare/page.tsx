import { CompareView } from '@/components/compare/compare-view';
import { Page, PageHeader } from '@/components/page';
import { compareParams } from '@/lib/compare';
import { compareChoices, compareModels } from '@/lib/server/compare';

export const metadata = {
  title: 'Compare Models',
  description: 'Compare the evaluation results, flagged chats, and Deploymeter scores of models side by side.',
};
export const dynamic = 'force-dynamic';

/** Up to `COMPARE_MAX` models side by side, from the URL's `id1`, `id2`, ...: their Deploymeters,
 * facts, eval results, and flagged chats by topic. In each row, the best value has a green cell. */
export default async function ComparePage({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  const names = compareParams(await searchParams);
  const [choices, models] = await Promise.all([compareChoices(), compareModels(names)]);
  return (
    <Page>
      <PageHeader title="Compare Models" />
      <CompareView names={names} models={models} choices={choices} />
    </Page>
  );
}
