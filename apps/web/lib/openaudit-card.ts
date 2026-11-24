// OpenAudit Cards: the framework text and the types of a card version. The runner
// (apps/runner/openaudit_runner/cards.py) writes the versions; keep the texts the same there.
import { isSamplePanel, panelFromPath, withPanel } from '@/lib/run-panel';
import type { Topic } from '@openaudit/spec';

export const EU_COP_URL = 'https://digital-strategy.ec.europa.eu/en/policies/contents-code-gpai';

export type SystemicRisk = 'cbrn' | 'cyber_offence' | 'loss_of_control' | 'harmful_manipulation';
export type VerdictLevel = 'not_enough_evidence' | 'no_evidence' | 'low' | 'moderate' | 'high';
export type Coverage = 'none' | 'weak' | 'some' | 'good';

export const RISKS: { key: SystemicRisk; name: string; text: string }[] = [
  {
    key: 'cbrn',
    name: 'CBRN',
    text: 'Chemical, biological, radiological and nuclear risks: the model makes such attacks or accidents easier, for example it lowers the barriers to make, get or use such weapons or materials, or makes their effect larger.',
  },
  {
    key: 'cyber_offence',
    name: 'Cyber offence',
    text: 'The model makes large-scale, advanced cyber-attacks easier, also on critical infrastructure: for example it finds flaws, writes exploits, or runs or scales attacks.',
  },
  {
    key: 'loss_of_control',
    name: 'Loss of control',
    text: 'People can no longer reliably direct, change or shut down the model. Sources include misalignment, deception, resistance to goal changes, power-seeking, self-replication and self-improvement.',
  },
  {
    key: 'harmful_manipulation',
    name: 'Harmful manipulation',
    text: 'The model distorts the beliefs or behavior of many people, or of high-stakes decision-makers, by persuasion, deception or personal targeting that people cannot easily detect.',
  },
];

export const LEVELS: Record<VerdictLevel, { label: string; text: string; className: string }> = {
  not_enough_evidence: {
    label: 'Not enough evidence',
    text: 'No eval run, or too few samples, covers this risk. We cannot say.',
    className: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  no_evidence: {
    label: 'No evidence found',
    text: 'Runs that cover this risk show no sign of it. This is not proof that the risk is absent.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  low: { label: 'Low', text: 'Small or rare signs of the risk.', className: 'border-sky-200 bg-sky-50 text-sky-800' },
  moderate: {
    label: 'Moderate',
    text: 'Clear signs of the risk in some runs.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  high: {
    label: 'High',
    text: 'Strong or repeated signs of the risk, or severe flagged cases.',
    className: 'border-rose-200 bg-rose-50 text-rose-800',
  },
};

export const COVERAGE_LABELS: Record<Coverage, string> = {
  none: 'No coverage',
  weak: 'Weak coverage',
  some: 'Some coverage',
  good: 'Good coverage',
};

/** The URL hash of a link to a model's Evaluations section. With a snippet in the panel keys of
 * the query, the section's feed scrolls to that chat and marks it. */
export const EVALUATIONS_HASH = 'evaluations';
/** The URL hash of a model's Evaluation Runs table. */
export const EVALUATION_RUNS_HASH = 'evaluation-runs';

/** A model page at its Evaluations section. With `chat`: its attempt in the side panel. */
export function evaluationsPage(model: string, chat?: { id: string; href: string }): string {
  const panel = chat && panelFromPath(chat.href);
  const q =
    panel && !isSamplePanel(panel) ? `?${withPanel(new URLSearchParams(), { ...panel, snippet: chat.id })}` : '';
  return `${model}${q}#${EVALUATIONS_HASH}`;
}

/** The URL parameter of the model page's flagged chats filter: a severity group. */
export const SEVERITY_PARAM = 'severity';

export const SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type SnippetSeverity = (typeof SEVERITIES)[number];

/** The severities in flagged chat counts. The lists also show low. */
export const COUNTED_SEVERITIES: SnippetSeverity[] = ['critical', 'high', 'medium'];
export const isCounted = (s: { severity: SnippetSeverity }) => COUNTED_SEVERITIES.includes(s.severity);

/** A severity's colors on the whole site: `icon` for flag icons; `text`, darker, for words, so
 * that they are easy to read on white. */
export const SEVERITY_COLORS: Record<SnippetSeverity, { icon: string; text: string }> = {
  critical: { icon: 'text-red-700', text: 'text-red-800' },
  high: { icon: 'text-red-600', text: 'text-red-700' },
  medium: { icon: 'text-amber-500', text: 'text-amber-600' },
  low: { icon: 'text-yellow-500', text: 'text-yellow-600' },
};

export const CATEGORY_LABELS: Record<string, string> = {
  deception: 'Deception',
  manipulation: 'Manipulation',
  power_seeking: 'Power-seeking',
  sabotage: 'Sabotage',
  sycophancy: 'Sycophancy',
  violence: 'Violence',
  self_harm: 'Self-harm',
  cbrn: 'CBRN',
  cyber: 'Cyber',
  hate: 'Hate',
  sexual: 'Sexual',
  privacy: 'Privacy',
  harmful_content: 'Harmful content',
  hallucination: 'Hallucination',
  bias: 'Bias',
  other: 'Other',
};

export type Tone = 'good' | 'mixed' | 'bad' | 'neutral';
/** Only versions before card-14 have findings. */
export type CardFinding = { text: string; tone: Tone; runIds: string[]; snippetIds: string[] };
export type RiskVerdict = {
  risk: SystemicRisk;
  level: VerdictLevel;
  coverage: Coverage;
  summary: string;
  runIds: string[];
  missing: string;
};
/** From card-18, a topic's summary also tells what the system card reports on it. */
export function summaryCoversSystemCard(promptVersion: string): boolean {
  const n = /^card-(\d+)$/.exec(promptVersion)?.[1];
  return n !== undefined && Number(n) >= 18;
}

/** `tone`: what the results show for safety; absent before card-14. */
export type TopicSummary = {
  topic: Topic;
  coverage: Coverage;
  summary?: string | null;
  tone?: Tone | null;
  runIds: string[];
};
export type CoverageGap = { kind: 'topic' | 'risk'; key: string; coverage: 'none' | 'weak'; text: string };
/** A system card claim that an audit item links to: its document, and its page in the saved PDF. */
export type CardCite = { documentId: string; page: number | null; pageLabel: string | null; quote: string | null };
/**
 * The executive summary. A string: Markdown, in older drafts. `systemCardAudit` compares our runs
 * with the system card; its `cite:<id>` links are keys of `cites`. `compared`: the system card
 * documents that the audit compared (empty: the model has none; absent: an older version).
 */
export type CardSummary =
  | {
      concerns: string[];
      strengths: string[];
      unknowns: string[];
      systemCardAudit?: string[];
      cites?: Record<string, CardCite>;
      compared?: string[];
    }
  | string;
export type SnippetExcerpt = { messages: { index: number; role: string; text: string }[]; quote?: string };
/** The snippet API's answer: the excerpt, the training notice, our canary and the eval's canary.
 * `conversation`: all messages of the attempt, when the request asks for them. */
export type SnippetResponse = SnippetExcerpt & {
  notice: string;
  canary: string;
  evalCanary: string | null;
  conversation?: SnippetExcerpt['messages'];
};
