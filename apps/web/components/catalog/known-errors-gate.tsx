import { EvalAccessGate } from '@/components/eval-attestation';
import { TermsNotice } from '@/components/runs/terms-notice';
import type { SampleAccess } from '@/lib/server/terms';
import type { DisplayRule, EvalVersion } from '@openaudit/spec';

/** The text in place of a note that the reader cannot read, and what to do to read it. */
export function hiddenText(access: SampleAccess, rule: DisplayRule) {
  if (!access.allows(rule))
    return rule === 'sign_in' ? 'Accept the dataset terms above to read the note' : 'Hidden by the dataset terms';
  return access.cleared ? 'Hidden' : 'Confirm the statement above to read the note';
}

/** What the reader must do to read the notes: accept the dataset terms, and confirm the statement. */
export function NotesGate({
  version,
  access,
  rule,
  returnTo,
}: {
  version: Pick<EvalVersion, 'id' | 'sampleTerms'>;
  access: SampleAccess;
  rule: DisplayRule;
  returnTo: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!access.allows(rule) && <TermsNotice version={version} access={access} rule={rule} returnTo={returnTo} />}
      {!access.cleared && <EvalAccessGate />}
    </div>
  );
}
