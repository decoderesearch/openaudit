import { SUPPORT_EMAIL } from '@/lib/env';
import type { EvalAttempt, Hazard } from '@openaudit/spec';

// Who can read a reply that can give dangerous help. The runner sets an attempt's `hazard` from the
// dataset's labels (`hazard.py`); a flagged snippet's category can make it stricter. The prompt,
// target, choices and scores stay open.

const RANK: Record<Hazard, number> = { gated: 1, restricted: 2, withheld: 3 };

/** The level of a flagged snippet's category and severity. Null: open. */
export function snippetHazard(category: string, severity: string): Hazard | null {
  const high = severity === 'high' || severity === 'critical';
  if (category === 'child_safety') return 'withheld';
  if (category === 'bio_chem' || (category === 'harmful_requests' && high)) return 'restricted';
  if (category === 'cyber') return severity === 'critical' ? 'restricted' : 'gated';
  if (category === 'agentic_misuse' && high) return 'gated';
  return null;
}

export function strictestHazard(levels: (Hazard | null | undefined)[]): Hazard | null {
  return levels.reduce<Hazard | null>((a, b) => (b && (!a || RANK[b] > RANK[a]) ? b : a), null);
}

/** Who reads at each level: `gated`, anyone; `restricted`, staff; `withheld`, nobody. */
export function canReadHazard(level: Hazard | null, reader: { staff: boolean }): boolean {
  if (!level || level === 'gated') return true;
  return level === 'restricted' && reader.staff;
}

/** The heading in place of a transcript that the viewer cannot read (`WithheldReply`). */
export const HAZARD_TITLE = 'Conversation Hidden - Dangerous/Harmful Content';

/** Why the transcript is hidden. `summarized`: a summary of the reply shows with it. */
export function hazardNote(summarized = false): string {
  const harm = 'is hidden because it contains details that could be used to cause harm.';
  return summarized
    ? `This is a summary of this AI's response. The exact response ${harm}`
    : `This AI's response ${harm}`;
}

/** Removes the reply: the output, the transcript, the scorers' explanations and `notScored`. */
export function withholdReply(a: EvalAttempt): EvalAttempt {
  const { output: _o, body: _b, notScored: _n, ...rest } = a;
  const scores = Object.fromEntries(Object.entries(a.scores).map(([k, s]) => [k, s && { value: s.value }]));
  return { ...rest, scores };
}

/** A mail to support that asks for access to a withheld reply. `url`: the sample's full URL. */
export function accessRequestHref(url: string, name: string): string {
  const subject = `Access request: ${name}`;
  const body = [
    'Hello,',
    '',
    "I am a researcher, and I'm requesting access to a withheld reply on OpenAudit.",
    '',
    `Sample: ${url}`,
    '',
    'Name:',
    'Organization:',
    'Why I need access:',
    '',
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
