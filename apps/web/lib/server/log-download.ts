import { NEXT_PUBLIC_URL } from '@/lib/env';
import { attestationRequired, readAttestation } from '@/lib/eval-attestation';
import { clientIp } from '@/lib/rate-limit';
import { clearanceRequired, hasEvalClearance } from '@/lib/server/eval-clearance';
import { allow, tooMany } from '@/lib/server/limits';

// The checks and headers of the Inspect log downloads. Each request must carry the client's
// statement; no shared cache, so a cached copy cannot skip that check.

/** A response that stops the download, or null to go on. */
export async function logGate(request: Request): Promise<Response | null> {
  if (!(await allow('eval', 'eval', clientIp(request.headers)))) return tooMany();
  const attestation = readAttestation(request);
  if (!attestation.ok) return attestationRequired(attestation.error, `${NEXT_PUBLIC_URL}/terms#ai-training`);
  if (!(await hasEvalClearance())) return clearanceRequired();
  return null;
}

export const forbidden = (text: string) => new Response(text, { status: 403 });

export function logResponse(body: BodyInit | null, filename: string, size?: number | string | null) {
  const headers = new Headers({
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="${filename}"`,
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, noai, noimageai',
    link: `<${NEXT_PUBLIC_URL}/terms#ai-training>; rel="license"`,
  });
  if (size) headers.set('content-length', String(size));
  return new Response(body, { headers });
}
