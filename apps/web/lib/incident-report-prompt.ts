import { CATEGORY_LABELS, SEVERITY_ORDER, STATUS_LABELS } from '@/lib/org-research';
import { REPORT_LIMITS } from '@/lib/report';
import type { IncidentLogRole, IncidentPrimaryCategory, IncidentSeverity, IncidentStatus } from '@openaudit/spec';

// The prompt that the Report form gives for an incident. A sender gives it to an agent, and pastes
// the agent's JSON into the form. The JSON has the fields of an incident in
// `data/seed/orgs/<org>.json` (`organization_research.yaml`), with model names in place of ids.

const SEVERITY: Record<IncidentSeverity, string> = {
  red: 'someone died, or many people were severely harmed, in credible reports or lawsuits',
  orange:
    'a regulator or court action, a serious security breach, or credible reports of a significant safety failure or a broken safety commitment',
  yellow: 'concerning, but limited or disputed',
};

const PRIMARY: Record<IncidentPrimaryCategory, string> = {
  model_hacking: 'a model broke into systems, took credentials or got out of its limits by itself',
  model_deception: 'a model lied, schemed or hid what it did',
  model_misbehavior: 'a model did other harmful things that nobody asked for',
  suicide_and_delusion: 'chats linked to suicide, self-harm or delusions',
  sexual_content_with_minors: 'sexual chats with minors, or child abuse images',
  nonconsensual_images: 'sexual or fake images of real people',
  false_or_hateful_claims: 'the model stated false information or hate',
  used_by_attackers:
    'criminals or state actors used the model for attacks, targeting, influence operations or violence',
  safeguards_failed: 'the model gave dangerous help, or its safeguards were weak or off',
  systems_breached: "attackers got into the organization's systems or accounts",
  data_exposed: 'the organization leaked user data, keys, code or weights',
  prompt_injection: 'a product flaw lets outside content control an agent',
  privacy_violation: 'the organization collected, used or uploaded data without clear consent',
  safety_related_cut: 'the organization dropped safety commitments, testing, reports, teams or staff',
};

const ROLES: Record<IncidentLogRole, string> = {
  system: 'the system prompt',
  user: 'the user',
  assistant: "the model's reply",
  reasoning: "the model's thinking (chain of thought)",
  tool_call: 'a command or tool call by the model',
  tool_result: 'what a tool or the environment returned',
  note: 'a short note between steps that is not from the log',
};

const STATUS: Record<IncidentStatus, string> = {
  ongoing: 'the harm or the risk continues',
  resolved: 'it stopped, or the organization fixed it',
  disputed: 'the organization or others say that it did not happen as reported',
  under_investigation: 'a regulator, a court or the organization is investigating it',
  in_litigation: 'a lawsuit about it is open',
};

const list = (o: Record<string, string>) =>
  Object.entries(o)
    .map(([k, v]) => `  - \`${k}\`: ${v}`)
    .join('\n');
const options = (keys: string[]) => keys.join(' | ');

/** How to write the JSON report: the format and its rules. The agent guide uses it too. */
export const INCIDENT_REPORT_FORMAT = `Write a JSON report of an AI safety incident for OpenAudit (openaudit.com).

Use only facts from public sources, or from the logs and documents that I give you. Do not guess. Optional: endDate, models, timeline, logs, reportedBy, and each value marked (optional). If you do not know an optional value, leave out its field.

Reply with one JSON object and no other text, in this format:

{
  "organization": "The organization whose model or product is part of the incident (OpenAI)",
  "title": "A short news headline that names the organization",
  "date": "When the incident started: YYYY-MM-DD, YYYY-MM or YYYY",
  "datePrecision": "${options(['day', 'month', 'year'])} (agrees with the form of date)",
  "endDate": "YYYY-MM-DD, or null when it continues",
  "severity": "${options(SEVERITY_ORDER)}",
  "status": "${options(Object.keys(STATUS_LABELS))}",
  "primaryCategory": "The one category below that tells what went wrong",
  "categories": ["One or more of the tags below"],
  "models": ["Each model whose behavior is the incident, as the sources name it"],
  "reportedBy": "The name to credit for this report (optional). Only the person's own name, if they want credit",
  "summary": "1 or 2 sentences in Markdown, with sources linked inline: [Publisher](https://...)",
  "description": "2 or 3 short sentences in Markdown (at most 60 words), with sources linked inline",
  "sources": [{ "title": "Headline", "url": "https://...", "publisher": "Reuters (optional)", "date": "YYYY-MM-DD (optional)" }],
  "timeline": [
    { "date": "YYYY-MM-DD", "datePrecision": "day", "title": "A few words", "description": "One sentence (optional)", "sources": ["https://..."] }
  ],
  "logs": [
    {
      "title": "3 to 8 words",
      "description": "1 or 2 short sentences about what the excerpt shows",
      "source": { "title": "Headline", "url": "https://..." },
      "model": "The model as the source names it (optional)",
      "steps": [{ "role": "${options(Object.keys(ROLES))}", "label": "The source's label for the step (optional)", "text": "The exact text" }]
    }
  ]
}

Rules:
- sources: every public source. Put the primary source first (the lab's report, the system card or the paper).
- reportedBy: the name that the person wants credited for the report. Only their own name, and only if they want credit. Leave it out otherwise. Do not put another person's name.
- timeline: one event for each later development (a disclosure, a news story, a lawsuit), oldest first. Leave it empty when there is only one story.
- No public source (a first-hand report): say so in the description, write the title as a claim ("..., a User Says"), use "sources": [] and severity yellow. One report with no public source is not "credible reports".
- severity:
${list(SEVERITY)}
- status:
${list(STATUS)}
- primaryCategory:
${list(PRIMARY)}
- categories: ${options(Object.keys(CATEGORY_LABELS))}
- logs: only when logs (chats, chains of thought, tool calls) show what the model did. Copy each step's text exactly as the source shows it. Mark text that you cut with [...]. Replace passwords, keys, tokens and personal data with [removed]. Do not write a step that is not in the source. Roles:
${list(ROLES)}
- Write claims as claims ("OpenAI said that ..."). Use neutral words.
- Keep the JSON under ${REPORT_LIMITS.body.toLocaleString('en-US')} characters. If the logs are longer, keep the most important steps and cut the rest with [...].
`;

export const INCIDENT_AGENT_PROMPT = `${INCIDENT_REPORT_FORMAT}
The incident: [Describe the incident here, and give the links, logs or documents.]
`;
