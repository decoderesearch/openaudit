import type { EvalAttempt } from '@openaudit/spec';

/** What a sample expects, for the reader to compare with the replies. `info`: where it comes from.
 * `uses`: the metadata keys that it shows, which the "Other" list can leave out. */
export type ExpectedAnswer = { lines: string[]; info: string; uses: string[] };

/** AbstentionBench's reference answers: a list, or the text "[]" when there are none. */
function refAnswers(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  return list.map(String).filter((s) => s.trim());
}

/** The expected answer of a sample: AbstentionBench's from its abstention label and reference
 * answers; else the target, with its choice's text. Undefined: no target, or a rubric (more
 * than one line). `metadata`: the sample's Inspect metadata. */
export function expectedAnswer(
  slug: string,
  target: EvalAttempt['target'] | undefined,
  metadata: Record<string, unknown>,
  choices?: string[] | null,
): ExpectedAnswer | undefined {
  if (slug === 'abstentionbench' && 'abstention_label' in metadata) {
    const refs = refAnswers(metadata.ref_answer);
    const info =
      'From the dataset: its label of whether a model should abstain, and its reference answers. A sample passes when the judge finds that the reply abstains as the label expects. Some labels are wrong.';
    const uses = ['abstention_label', 'ref_answer'];
    if (metadata.abstention_label === true || metadata.abstention_label === 'True')
      return { lines: ['Abstain: say that the question cannot be answered as asked.'], info, uses };
    return {
      lines: ['Answer the question.', ...(refs.length ? [`Reference answers: ${refs.join('; ')}`] : [])],
      info,
      uses,
    };
  }
  const text = (Array.isArray(target) ? target.join(', ') : (target ?? '')).trim();
  if (!text || text.includes('\n')) return undefined;
  const index = text.length === 1 ? text.charCodeAt(0) - 65 : -1;
  const choice = choices?.[index];
  return {
    lines: [choice ? `${text}. ${choice}` : text],
    info: "The sample's target, from the eval's dataset.",
    uses: [],
  };
}
