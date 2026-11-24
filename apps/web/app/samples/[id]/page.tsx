import { NavSection } from '@/components/nav/nav-section';
import { Page } from '@/components/page';
import { SampleAttempts } from '@/components/runs/sample-attempts';
import { parseId } from '@/lib/ids';
import { shareMetadata } from '@/lib/og/meta';
import { getSampleAttempts } from '@/lib/server/runs';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

type Props = { params: Promise<{ id: string }> };

const load = cache(async (id: string) => {
  const uuid = parseId(id);
  return uuid ? getSampleAttempts(uuid) : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const found = await load(id);
  const robots = { index: false, follow: false };
  if (!found) return { title: 'Sample', robots };
  const title = `${found.sample.sourceId} · ${found.eval.displayName}`;
  const description = `One sample of ${found.eval.displayName}, and each model's attempts on it.`;
  return { title, description, robots, ...shareMetadata(title, description, `/samples/${id}`) };
}

export default async function SamplePage({ params }: Props) {
  const found = await load((await params).id);
  if (!found) notFound();
  return (
    <Page className="lg:pb-5">
      <NavSection method={found.eval.facets.subjects.includes('method')} />
      <SampleAttempts found={found} />
    </Page>
  );
}
