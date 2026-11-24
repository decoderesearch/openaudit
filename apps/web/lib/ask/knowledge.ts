import { ASK_TOURS } from '@/lib/ask/pages';
import { SITE_GUIDE } from '@/lib/ask/site-guide';
import { AGENT_GUIDE_PATH, AGENT_PATHS, AGENT_PROMPTS, CONTRIBUTE_WAYS, type ContributeWay } from '@/lib/contribute';
import { FAQ_SECTIONS } from '@/lib/faqs';
import { HARNESSES } from '@/lib/submissions';
import { TOPIC_INFO, TOPIC_LABELS, topicPath } from '@/lib/topics';
import { WHY_REASONS } from '@/lib/why';
import type { Topic } from '@openaudit/spec';

// The site assistant's knowledge, made from the same sources as the pages: the site guide, the Why
// OpenAudit reasons, the FAQs, the Contribute page, the topics and the tours. When one of these
// sources moves, change its import here (see "The site assistant" in AGENTS.md).

/** Markdown from a template literal, without the indent of the source code. */
const flat = (md: string) =>
  md
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function why() {
  return WHY_REASONS.filter((r) => flat(r.solution) && flat(r.solution) !== 'TODO')
    .map((r) => {
      const parts = [
        ['Problem', r.problem],
        ['Solution', r.solution],
        ['Examples', r.examples],
        ['Caveats', r.caveats ?? ''],
      ].filter(([, text]) => flat(text));
      return [`## ${r.head} (/features#${r.id})`, ...parts.map(([name, text]) => `${name}: ${flat(text)}`)].join(
        '\n\n',
      );
    })
    .join('\n\n');
}

function faqs() {
  return FAQ_SECTIONS.map((s) =>
    [
      `## ${s.title}`,
      ...s.faqs.map((f) => `### ${f.question} (/faqs#${f.id})\n\n${flat(f.answer) || '(no answer yet)'}`),
    ].join('\n\n'),
  ).join('\n\n');
}

const PROMPT_NOTE = 'The person copies this prompt into their AI agent:';

/** The diagram of the agent's paths, and the button to the guide, as text. */
function agentPaths() {
  const { start, branches, paths, ends } = AGENT_PATHS;
  const end = (p: (typeof paths)[number]) =>
    p.branch === 'research' ? 'a pull request (a suggestion: the Submit form)' : 'the Submit form';
  return [
    `Button: View Raw Prompt File (${AGENT_GUIDE_PATH}).`,
    `A diagram of the paths of the agent guide. ${start.label} ${start.file}: ${start.about}`,
    ...branches.map((b) =>
      [
        `- ${b.label}: ${b.about}`,
        ...paths
          .filter((p) => p.branch === b.id)
          .map(
            (p) =>
              `  - ${p.label} (${p.level}${'example' in p ? `, for example ${p.example}` : ''}, /contribute#${p.anchor}): ${p.about} It ends in ${end(p)}.`,
          ),
      ].join('\n'),
    ),
    ...ends.map((e) => `- ${e.label}: ${e.about}`),
  ].join('\n');
}

function way(w: ContributeWay, depth: number): string {
  const lines = [`${'#'.repeat(Math.min(depth, 6))} ${w.title} (/contribute#${w.id})`];
  if (flat(w.text)) lines.push(flat(w.text));
  if (w.links?.length) lines.push(`Links: ${w.links.map(([label, href]) => `[${label}](${href})`).join(', ')}`);
  if (w.prompt) lines.push(`${PROMPT_NOTE}\n\n\`\`\`\n${AGENT_PROMPTS[w.prompt]}\n\`\`\``);
  if (w.action === 'private') lines.push('Button: Submit Private Evaluation (/submit?type=evaluation&access=private).');
  if (w.action === 'contact') lines.push('Button: Contact Us (email support@openaudit.com).');
  if (w.action === 'paths') lines.push(agentPaths());
  return [lines.join('\n\n'), ...(w.items ?? []).map((i) => way(i, depth + 1))].join('\n\n');
}

function contribute() {
  return [
    `## TL;DR (/contribute#tldr)\n\nTo contribute anything, copy this prompt into an AI agent. The agent reads ${AGENT_GUIDE_PATH}, asks about the person's goal, budget, level and field, and guides them from the idea to the submission.\n\n\`\`\`\n${AGENT_PROMPTS.any}\n\`\`\``,
    ...CONTRIBUTE_WAYS.map((w) => way(w, 2)),
  ].join('\n\n');
}

function harnesses() {
  return Object.entries(HARNESSES)
    .map(([method, list]) => `- ${method}: ${list.flatMap((h) => h.evals.map((e) => `/evaluations/${e}`)).join(', ')}`)
    .join('\n');
}

function tours() {
  return ASK_TOURS.map((t) => `- ${t.id}: ${t.title}. Shows these kinds of page: ${t.kinds.join(', ')}.`).join('\n');
}

/** All of the knowledge, as one Markdown text. It is the same for each request, so it caches. */
export const ASK_KNOWLEDGE = [
  SITE_GUIDE,
  `# OpenAudit Features (the /features page)\n\n${why()}`,
  `# Frequently Asked Questions (the /faqs page)\n\n${faqs()}`,
  `# How to Contribute (the /contribute page)\n\n${contribute()}`,
  `# Methods that have a method evaluation harness, and the evaluations that it runs\n\n${harnesses()}`,
  `# Safety topics (/topics/<topic>)\n\n${Object.entries(TOPIC_LABELS)
    .map(([topic, label]) => `- ${label} (${topicPath(topic as Topic)}): ${TOPIC_INFO[topic as Topic]}`)
    .join('\n')}`,
  `# Guided tours that you can offer ([tour:<id>])\n\n${tours()}`,
].join('\n\n');
