import { parseId } from '@/lib/ids';
import { attemptPathById } from '@/lib/server/runs';
import { notFound, redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ snippet?: string }> };

// A temporary redirect: the run's URL can change, so browsers must not keep it.
export default async function AttemptLink({ params, searchParams }: Props) {
  const [{ id }, { snippet }] = await Promise.all([params, searchParams]);
  const uuid = parseId(id);
  const path = uuid && (await attemptPathById(uuid));
  if (!path) notFound();
  redirect(snippet ? `${path}?snippet=${encodeURIComponent(snippet)}` : path);
}
