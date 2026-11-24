import { Flag, ReviewCard } from '@/components/deploymeter/review-card';
import Link from '@/components/link';
import { Empty, Page, PageHeader } from '@/components/page';
import { shareMetadata } from '@/lib/og/meta';
import { judgeReviews } from '@/lib/server/deploymeter';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ lab: string; model: string }> };

const judgeOf = async (params: Props['params']) => {
  const { lab, model } = await params;
  return `${decodeURIComponent(lab)}/${decodeURIComponent(model)}`;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const judge = await judgeOf(params);
  const found = await judgeReviews(judge);
  if (!found) return { title: 'Judge' };
  const title = `${found.name} as a Deploymeter Judge`;
  const description = `How ${found.name} reviewed each model for the Deploymeter: ${found.reviews.length} published reviews.`;
  return { title, description, ...shareMetadata(title, description, `/judges/${judge}`) };
}

/** One AI judge: each of its published Deploymeter reviews, newest first. */
export default async function JudgePage({ params }: Props) {
  const found = await judgeReviews(await judgeOf(params));
  if (!found) notFound();
  return (
    <Page>
      <PageHeader
        eyebrow={
          <Link href="/judges" className="hover:text-sky-800 hover:underline">
            Deploymeter Judges
          </Link>
        }
        title={found.name}
        description={
          <span className="text-xs">
            <span className="font-mono">{found.judge}</span>
            {!found.onPanel && (
              <>
                {' · '}
                <Flag tone="amber">Not on the panel now</Flag>
              </>
            )}
          </span>
        }
      />
      {found.reviews.length === 0 ? (
        <Empty>No published reviews yet.</Empty>
      ) : (
        <ul className="flex flex-col divide-y divide-slate-100 overscroll-contain rounded-lg border border-slate-200 bg-white px-4 lg:max-h-[calc(100dvh-16rem)] lg:min-h-64 lg:overflow-y-auto">
          {found.reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={r}
              guess
              title={
                <Link href={r.modelHref} className="hover:text-sky-800 hover:underline">
                  {r.model}
                </Link>
              }
              tags={
                <span className="text-[11px] font-normal text-slate-500">
                  {r.developer} · panel score {r.panelScore ?? '–'} · {r.date.toISOString().slice(0, 10)}
                </span>
              }
            />
          ))}
        </ul>
      )}
    </Page>
  );
}
