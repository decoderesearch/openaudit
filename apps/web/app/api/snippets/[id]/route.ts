import { NEXT_PUBLIC_URL } from '@/lib/env';
import { attestationRequired, readAttestation } from '@/lib/eval-attestation';
import { isUuid } from '@/lib/ids';
import { clientIp } from '@/lib/rate-limit';
import { hazardNote } from '@/lib/runs/hazard';
import { clearanceRequired, hasEvalClearance } from '@/lib/server/eval-clearance';
import { allow, tooMany } from '@/lib/server/limits';
import { snippetExcerpt, snippetWithheld, type Withheld } from '@/lib/server/openaudit-cards';
import { snippetConversation } from '@/lib/server/snippet-conversation';
import { getViewer, isAdmin } from '@/lib/server/viewer';

// The excerpt of one flagged chat snippet. The model page loads it when the reader opens the snippet.
// `?conversation=1` adds all messages of the attempt.
// The answer depends on the viewer (dataset terms), and it is eval content: no cache, no index,
// and each request must carry the client's statement (`lib/eval-attestation.ts`). A reply that the
// statement cannot unlock gets its hazard note first.
const TERMS_URL = `${NEXT_PUBLIC_URL}/terms#ai-training`;
const HEADERS = {
  'cache-control': 'private, no-store',
  'x-robots-tag': 'noindex, noai, noimageai',
  link: `<${TERMS_URL}>; rel="license"`,
};

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await allow('eval', 'eval', clientIp(request.headers)))) return tooMany();
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: 'Not found.' }, { status: 404 });
  const drafts = isAdmin(await getViewer());
  const withheld = await snippetWithheld(id, { drafts });
  if (withheld) return withheldResponse(withheld);
  const attestation = readAttestation(request);
  if (!attestation.ok) return attestationRequired(attestation.error, TERMS_URL);
  if (!(await hasEvalClearance())) return clearanceRequired();
  const excerpt = await snippetExcerpt(id, { drafts });
  if (!excerpt) return Response.json({ error: 'Not found.' }, { status: 404 });
  if (excerpt === 'hidden')
    return Response.json(
      { error: "The dataset's terms do not let you read this excerpt.", hidden: true },
      { status: 403, headers: HEADERS },
    );
  if ('withheld' in excerpt) return withheldResponse(excerpt);
  const full = new URL(request.url).searchParams.get('conversation') === '1';
  const conversation = full ? await snippetConversation(id) : null;
  return Response.json(conversation ? { ...excerpt, conversation } : excerpt, { headers: HEADERS });
}

const withheldResponse = ({ withheld, summary }: Withheld) =>
  Response.json(
    { error: hazardNote(!!summary), hidden: true, hazard: withheld, summary },
    { status: 403, headers: HEADERS },
  );
