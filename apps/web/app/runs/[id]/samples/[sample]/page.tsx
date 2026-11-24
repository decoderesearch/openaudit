import { NavSection } from '@/components/nav/nav-section';
import { Page } from '@/components/page';
import { SampleAttempts } from '@/components/runs/sample-attempts';
import { parseId } from '@/lib/ids';
import { shareMetadata } from '@/lib/og/meta';
import { getSampleAttempts } from '@/lib/server/runs';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

type Props = { params: Promise<{ id: string; sample: string }> };

const load = cache(async (id: string, sample: string) => {
  const runId = parseId(id);
  const sampleId = parseId(sample);
  const found = runId && sampleId ? await getSampleAttempts(sampleId, runId) : null;
  return runId && found?.attempts.length ? { found, run: { id: runId } } : null;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  const loaded = await load(p.id, p.sample);
  const robots = { index: false, follow: false };
  if (!loaded) return { title: 'Sample', robots };
  const { sample, eval: e } = loaded.found;
  const title = `${sample.sourceId} · ${e.displayName}`;
  const description = `One sample of ${e.displayName}, and each model's attempts on it.`;
  return {
    title,
    description,
    robots,
    ...shareMetadata(title, description, `/runs/${p.id}/samples/${p.sample}`, `/runs/${p.id}/opengraph-image`),
  };
}

export default async function RunSamplePage({ params }: Props) {
  const p = await params;
  const loaded = await load(p.id, p.sample);
  if (!loaded) notFound();
  return (
    <Page className="lg:pb-5">
      <NavSection method={loaded.found.eval.facets.subjects.includes('method')} />
      <SampleAttempts found={loaded.found} run={loaded.run} />
    </Page>
  );
}
