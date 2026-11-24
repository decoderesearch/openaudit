import { evalListQuery, parseEvalListFilter } from '@/lib/eval-list-filter';
import { permanentRedirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** The model evals are on the Models page, and the method evals on the Methods page. */
export default async function EvalsPage({ searchParams }: { searchParams: Promise<Record<string, unknown>> }) {
  permanentRedirect(`/models${evalListQuery(parseEvalListFilter(await searchParams))}`);
}
