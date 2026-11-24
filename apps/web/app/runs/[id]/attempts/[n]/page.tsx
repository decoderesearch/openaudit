import { NavSection } from '@/components/nav/nav-section';
import { Page } from '@/components/page';
import { AttemptView, attemptTitle, loadAttempt } from '@/components/runs/attempt-view';
import { shareMetadata } from '@/lib/og/meta';
import { snippetFocus } from '@/lib/server/snippet-focus';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ id: string; n: string }>; searchParams: Promise<{ snippet?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, n } = await params;
  const found = await loadAttempt(id, n);
  const robots = { index: false, follow: false };
  if (!found) return { title: 'Attempt', robots };
  const title = attemptTitle(found);
  const description = `One attempt of ${found.model.displayName} on a sample of ${found.eval.displayName}: the chat and its score.`;
  return {
    title,
    description,
    robots,
    ...shareMetadata(title, description, `/runs/${id}/attempts/${n}`, `/runs/${id}/opengraph-image`),
  };
}

export default async function AttemptPage({ params, searchParams }: Props) {
  const [{ id, n }, { snippet }] = await Promise.all([params, searchParams]);
  const found = await loadAttempt(id, n);
  if (!found) notFound();
  const flag = await snippetFocus(snippet, found.attempt.id);
  return (
    <Page fit="lg">
      <NavSection method={found.eval.facets.subjects.includes('method')} />
      <div className="@container flex flex-col gap-y-5 lg:min-h-0 lg:flex-1">
        <AttemptView found={found} mode="page" focus={flag?.focus} flag={flag} />
      </div>
    </Page>
  );
}
