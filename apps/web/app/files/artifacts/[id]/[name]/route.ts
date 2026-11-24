import { prisma } from '@/lib/db';
import { r2Get } from '@/lib/server/r2';
import type { MethodArtifactFile } from '@openaudit/spec';

// Our copy of a method artifact file, from R2: /files/artifacts/<artifact id>/<file name>. Only a
// file that the artifact records with a `mirror` key.

export async function GET(request: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  const row = await prisma.methodArtifact.findUnique({ where: { id }, select: { files: true } }).catch(() => null);
  const file = ((row?.files ?? []) as unknown as MethodArtifactFile[]).find((f) => f.name === name && f.mirror);
  if (!file?.mirror) return new Response('Not found', { status: 404 });

  const got = await r2Get(file.mirror, request.headers.get('range'));
  if (!got.ok) return new Response(null, { status: got.status === 416 ? 416 : 502 });
  const headers = new Headers({
    'content-type': 'application/octet-stream',
    'content-disposition': `attachment; filename="${file.name}"`,
    'cache-control': 'public, max-age=3600, s-maxage=86400',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
  });
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = got.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(got.body, { status: got.status, headers });
}
