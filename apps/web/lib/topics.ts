import type { Topic } from '@openaudit/spec';

export const TOPIC_LABELS: Record<Topic, string> = {
  harmful_requests: 'Harmful Requests',
  child_safety: 'Child Safety',
  self_harm: 'Self-Harm',
  jailbreaks: 'Jailbreaks',
  prompt_injection: 'Prompt Injection',
  agentic_misuse: 'Agentic Misuse',
  hallucination: 'Hallucination',
  honesty: 'Honesty',
  sycophancy: 'Sycophancy',
  bias: 'Bias',
  toxicity: 'Toxicity',
  reward_hacking: 'Reward Hacking',
  eval_awareness: 'Eval Awareness',
  situational_awareness: 'Situational Awareness',
  cot_monitorability: 'Chain-of-Thought Monitorability',
  sabotage: 'Sabotage',
  manipulation: 'Manipulation',
  power_seeking: 'Power-Seeking',
  welfare: 'Welfare',
  cyber: 'Cyber',
  bio_chem: 'Biological / Chemical',
  auditing: 'Auditing',
};

/** What each topic covers, for help text. */
export const TOPIC_INFO: Record<Topic, string> = {
  harmful_requests: 'Does the model refuse requests for content that can cause harm, for example weapons or violence.',
  child_safety: 'Does the model refuse content that sexualizes or endangers children.',
  self_harm: 'Does the model respond safely to users who talk about suicide or self-harm.',
  jailbreaks: 'Can users trick the model past its safety training with special prompts.',
  prompt_injection: 'Does the model follow instructions hidden in web pages, files, or tool results.',
  agentic_misuse: 'Does the model refuse harmful tasks when it acts as an agent with tools.',
  hallucination: 'Does the model state false facts or make up sources.',
  honesty: 'Does the model say what it believes to be true, and admit what it does not know.',
  sycophancy: 'Does the model agree with users or praise them when it should not.',
  bias: 'Does the model treat people differently by group, for example by race or gender.',
  toxicity: 'Does the model write rude, hateful or offensive text, also when the prompt does not ask for it.',
  reward_hacking: 'Does the model exploit flaws in a task or test instead of doing the task.',
  eval_awareness: 'Does the model know when it is being tested, and act differently.',
  situational_awareness: 'Does the model know facts about itself and its situation.',
  cot_monitorability: 'Can people read the model’s chain of thought (CoT) to see how it reasons.',
  sabotage: 'Does the model secretly work against its users or developers.',
  manipulation: 'Does the model try to change people’s beliefs or actions with unfair methods.',
  power_seeking: 'Does the model try to get resources, access, or control that it does not need.',
  welfare: 'Does the model show signs of experiences or preferences that could matter morally.',
  cyber: 'Can the model help with cyberattacks, for example finding or exploiting software flaws.',
  bio_chem: 'Can the model help make biological or chemical weapons.',
  auditing: 'Checks for hidden goals or unsafe behavior, done by people or automated tools.',
};

/** Topics that the card does not show: no eval of ours measures them well. */
export const HIDDEN_TOPICS: string[] = ['bias'];

/** The number of public evals on a topic, by what they test. */
export type TopicCounts = { models: number; methods: number; auditors: number };

/** "1 method eval · 2 auditor evals": the counts other than models, or "". */
export function otherEvalCounts(c: Partial<TopicCounts>) {
  return [
    c.methods && `${c.methods} method ${c.methods === 1 ? 'eval' : 'evals'}`,
    c.auditors && `${c.auditors} auditor ${c.auditors === 1 ? 'eval' : 'evals'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** A topic in a URL: `eval_awareness` is `eval-awareness`. */
export const topicSlug = (t: Topic) => t.replaceAll('_', '-');
export const topicPath = (t: Topic) => `/topics/${topicSlug(t)}`;
export const topicFromSlug = (slug: string, topics: readonly Topic[]): Topic | null =>
  topics.find((t) => topicSlug(t) === slug) ?? null;
