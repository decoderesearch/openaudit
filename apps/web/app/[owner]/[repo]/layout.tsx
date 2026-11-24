import { findModel, findModelByAlias, isHiddenModel, modelPath } from '@/lib/server/catalog';
import { getViewer, isAdmin } from '@/lib/server/viewer';
import { notFound, permanentRedirect } from 'next/navigation';

// A hidden model (or a model of a hidden organization), and its subpages: admins only. Others get 404.
// A path with a model's alias goes to that model's page.
export default async function ModelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const row = await findModel(owner, repo);
  if (!row) {
    const named = await findModelByAlias(owner, repo);
    if (named) permanentRedirect(modelPath(named));
  }
  if (row && (await isHiddenModel(row.id)) && !isAdmin(await getViewer())) notFound();
  return children;
}
