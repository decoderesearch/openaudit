import { prisma } from '@/lib/db';
import { r2Get } from '@/lib/server/r2';

// Our saved copy of a document, from R2: /files/documents/<key>.<pdf|html>, the same path as in
// the bucket. Same origin, so the PDF viewer can frame it. Range requests pass through, so a
// large PDF shows its first pages before the rest loads.

const TYPES = { pdf: 'application/pdf', html: 'text/html; charset=utf-8' } as const;
// A saved web page is someone else's HTML: no scripts, and a unique origin.
const HTML_CSP = "sandbox; default-src 'none'; img-src * data:; style-src * 'unsafe-inline'; font-src *";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file: name } = await params;
  const key = name.replace(/\.(pdf|html)$/, '');
  const doc = await prisma.document.findUnique({ where: { key }, select: { fileKey: true, fileType: true } });
  const type = doc?.fileType as keyof typeof TYPES | undefined;
  if (!doc?.fileKey || !type || doc.fileKey !== `documents/${name}`) return new Response('Not found', { status: 404 });

  const file = await r2Get(doc.fileKey, request.headers.get('range'));
  if (!file.ok) return new Response(null, { status: file.status === 416 ? 416 : 502 });
  const headers = new Headers({
    'content-type': TYPES[type],
    'content-disposition': `inline; filename="${name}"`,
    'cache-control': 'public, max-age=3600, s-maxage=86400',
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
  });
  for (const h of ['content-length', 'content-range', 'etag', 'last-modified']) {
    const v = file.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (type === 'html') headers.set('content-security-policy', HTML_CSP);
  return new Response(file.body, { status: file.status, headers });
}
