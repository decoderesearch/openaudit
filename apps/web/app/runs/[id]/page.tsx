import { NavSection } from '@/components/nav/nav-section';
import { Page } from '@/components/page';
import { RunView, loadRun, runTitle } from '@/components/runs/run-view';
import { shareMetadata } from '@/lib/og/meta';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ show?: string; metric?: string }>;
};

// Attempts show eval samples: keep them out of search and training crawls.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const found = await loadRun(id);
  const robots = { index: false, follow: false };
  if (!found) return { title: 'Run', robots };
  const title = runTitle(found);
  const description = `The results of ${found.eval.displayName} on ${found.model.displayName}: the score, and each sample with the model's attempts.`;
  return {
    title,
    description,
    robots,
    ...shareMetadata(title, description, `/runs/${id}`, `/runs/${id}/opengraph-image`),
  };
}

export default async function RunPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const found = await loadRun(id);
  if (!found) notFound();
  return (
    <Page className="lg:pb-5">
      <NavSection method={found.eval.facets.subjects.includes('method')} />
      <div className="@container flex flex-col gap-y-3">
        <RunView found={found} id={id} show={sp.show} metric={sp.metric} mode="page" />
      </div>
    </Page>
  );
}
