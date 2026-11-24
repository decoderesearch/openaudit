// Known errors in eval samples (EVAL_KNOWN_ERRORS.md). Safe in server and client code.

export const ISSUE_KINDS = {
  label_error: 'Label error',
  missing_context: 'Missing context',
  prompt_conflict: 'Prompt conflict',
  grader_error: 'Grader error',
  other: 'Other',
} as const;
export type IssueKind = keyof typeof ISSUE_KINDS;
export type IssueStatus = 'proposed' | 'confirmed' | 'rejected';

export const kindLabel = (kind: string) => ISSUE_KINDS[kind as IssueKind] ?? kind;

/** An issue with its sample. `graded`: the sample's graded replies now. `found`: the failed and
 * graded replies when the review found the issue. */
export type KnownErrorItem = {
  id: string;
  href: string;
  split: string;
  sourceId: string;
  graded: number;
  found: string | null;
  kind: string;
  status: IssueStatus;
  effect: string;
  /** Null when the reader cannot read the eval's samples: a note can quote its sample. */
  note: string | null;
  source: string;
  /** Set in lists of more than one eval. */
  eval?: { slug: string; name: string; version: string };
};
