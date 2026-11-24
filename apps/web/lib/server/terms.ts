import { prisma } from '@/lib/db';
import { canReadHazard } from '@/lib/runs/hazard';
import { termsText } from '@/lib/runs/terms';
import { hasEvalClearance } from '@/lib/server/eval-clearance';
import { getViewer } from '@/lib/server/viewer';
import type { DisplayRule, EvalVersion, Hazard } from '@openaudit/spec';

export type SampleAccess = {
  /** The hash of the terms text; null when the version has no terms. */
  termsSha256: string | null;
  signedIn: boolean;
  accepted: boolean;
  /** The viewer may read eval content at all (`lib/server/eval-clearance.ts`). */
  cleared: boolean;
  /** A moderator or admin: can read restricted replies and the full run log. */
  staff: boolean;
  /** The dataset's rule allows this viewer, before clearance. */
  allows: (rule: DisplayRule) => boolean;
  /** Both: the viewer can read the sample text now. */
  canRead: (rule: DisplayRule) => boolean;
  /** The viewer can read a reply of this hazard level now (`lib/runs/hazard.ts`). */
  canReadReply: (level: Hazard | null) => boolean;
  /** The level lets this viewer read the reply, before clearance. False: the statement cannot help. */
  hazardAllows: (level: Hazard | null) => boolean;
};

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What the viewer can read of this version's samples. */
export async function sampleAccess(version: Pick<EvalVersion, 'id' | 'sampleTerms'>): Promise<SampleAccess> {
  const terms = version.sampleTerms;
  const [viewer, cleared] = await Promise.all([getViewer(), hasEvalClearance()]);
  const termsSha256 = terms ? await sha256Hex(termsText(terms)) : null;
  const row =
    viewer && !viewer.banned && termsSha256
      ? await prisma.termsAcceptance.findUnique({
          where: { userId_evalVersionId: { userId: viewer.id, evalVersionId: version.id } },
          select: { termsSha256: true },
        })
      : null;
  const accepted = row?.termsSha256 === termsSha256;
  const allows = (rule: DisplayRule) => rule === 'open' || (rule === 'sign_in' && accepted);
  const reader = {
    signedIn: Boolean(viewer && !viewer.banned),
    staff: Boolean(viewer && !viewer.banned && (viewer.role === 'admin' || viewer.role === 'moderator')),
  };
  return {
    termsSha256,
    signedIn: Boolean(viewer),
    accepted,
    cleared,
    staff: reader.staff,
    allows,
    canRead: (rule) => cleared && allows(rule),
    canReadReply: (level) => cleared && canReadHazard(level, reader),
    hazardAllows: (level) => canReadHazard(level, reader),
  };
}

/** The rules that apply to a run's attempts: its version's rule and any subset rules. */
export async function runRules(runId: string): Promise<DisplayRule[]> {
  const rows = await prisma.evalAttempt.findMany({
    where: { runId, display: { not: null } },
    distinct: ['display'],
    select: { display: true },
  });
  return rows.map((r) => r.display as DisplayRule);
}
