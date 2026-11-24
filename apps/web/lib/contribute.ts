import { NEXT_PUBLIC_URL, SITE_NAME, SUPPORT_EMAIL } from '@/lib/env';
import { DONATE_URL } from '@/lib/legal';
import { HARNESSES, REPO_URL, submitPath } from '@/lib/submissions';

/** The guide for AI agents that help a person contribute. */
export const AGENT_GUIDE_PATH = '/contribute/agents.md';

const guide = `${NEXT_PUBLIC_URL}${AGENT_GUIDE_PATH}`;
const want = (action: string) => `I want to ${action}.\nRead ${guide} and follow it.`;
const research = (what: string) => want(`contribute ${what} to ${SITE_NAME}`);

const form = (what: string) =>
  `I want to report ${what}.\nRead ${guide} and follow its part "Incidents and commitments".`;

/** The prompts that a person copies into their agent, one for each type of contribution. */
export const AGENT_PROMPTS = {
  any: `I want to contribute to ${SITE_NAME}.\nRead ${guide} and follow it.`,
  modelEvaluationExisting: want(`contribute, suggest, or port an existing model evaluation to ${SITE_NAME}`),
  modelEvaluationNew: want(`build and contribute a new model evaluation to ${SITE_NAME}`),
  variant: research('a variant of a safety method'),
  newMethod: research('a new safety method'),
  methodEvaluation: research('an evaluation of safety methods'),
  evalErrors: `I want to help find errors in the evaluations on ${SITE_NAME}, starting with the items that the most models fail.\nRead ${guide} and follow its part "Review evaluations for errors".`,
  incident: form('an AI incident'),
  commitment: form("an organization's safety commitment"),
};

/** The paths of the agent guide, for the diagram under "OpenAudit's AI Agent Prompt": the guide
 * (`file`), its first question (`branches`), the kinds of contribution, and where each one ends.
 * `about`: the hover text. `anchor`: the way to contribute that a path links to. `example`: a
 * known item of that kind. The site assistant reads these too. */
export const AGENT_PATHS = {
  start: {
    label: 'Contribution',
    file: 'agents.md',
    about: 'Your agent reads the guide, checks its model and its tools, then asks about your goal.',
  },
  branches: [
    {
      id: 'research',
      label: 'Research and Build',
      about:
        'The agent asks your level, time, GPU, budget and field. Then you research, build, test and submit, with checkpoints.',
    },
    {
      id: 'report',
      label: 'Report or Suggest',
      about: 'No research and no build. The agent asks questions and writes the text with you.',
    },
  ],
  paths: [
    {
      id: 'model-eval',
      branch: 'research',
      label: 'Model Evaluation',
      level: 'Novice-friendly',
      anchor: 'model-evaluations',
      example: 'AgentHarm',
      about:
        'For novices and people with no GPU, domain experts, and people who port a published benchmark. A run costs a few dollars of API calls.',
    },
    {
      id: 'method',
      branch: 'research',
      label: 'Safety Method or Variant',
      level: 'More advanced',
      anchor: 'methods-variants',
      example: 'Jacobian Lens',
      about:
        'For interpretability researchers and ML engineers. It usually needs a GPU. A method with no harness yet goes through the Submit form.',
    },
    {
      id: 'method-eval',
      branch: 'research',
      label: 'Method Evaluation',
      level: 'Most advanced',
      anchor: 'method-evaluations',
      example: 'SAEBench',
      about: 'For researchers who build safety benchmarks. It needs a ground truth, and runs on several methods.',
    },
    {
      id: 'incident',
      branch: 'report',
      label: 'Incident or Commitment',
      level: 'Anyone',
      anchor: 'commitments-incidents',
      about:
        'For anyone who saw an AI system cause harm, or who tracks what labs promise. No code. Do not give sensitive data to the agent.',
    },
    {
      id: 'errors',
      branch: 'report',
      label: 'Errors in Evaluations',
      level: 'No code',
      anchor: 'improve-evaluations',
      about: 'For novices, and for domain experts who can check an answer key. No code and no cost.',
    },
    {
      id: 'ideas',
      branch: 'report',
      label: 'Ideas and Feedback',
      level: 'Anyone',
      anchor: 'submit-ideas-suggestions',
      about: 'For anyone with an idea, a suggestion, or feedback on the guide.',
    },
  ],
  ends: [
    {
      id: 'pr',
      label: 'Pull Request',
      about: 'From your fork, after you approve all files and text. We run it at our cost.',
    },
    {
      id: 'form',
      label: 'Submit Form',
      href: '/submit',
      about: 'The agent writes the text and a link that fills in the form. You submit it.',
    },
  ],
} as const;

/** A way to contribute on the Contribute page. `text`: Markdown. `links`: a line of links under
 * the text. `prompt`: the agent prompt to copy, under the text. `action`: a button under the text,
 * or the diagram of the agent's paths (`ACTIONS` in `app/contribute/page.tsx`). The site assistant
 * reads these too. */
export type ContributeWay = {
  id: string;
  title: string;
  text: string;
  links?: [label: string, href: string][];
  prompt?: keyof typeof AGENT_PROMPTS;
  action?: 'private' | 'contact' | 'paths';
  items?: ContributeWay[];
};

/** The names of the methods with a harness, for their submit pages. */
const METHOD_NAMES: Record<string, string> = {
  probes: 'Probes',
  'llm-monitors': 'LLM Monitors',
  'logprob-classifiers': 'Logprob Classifiers',
  'workspace-lenses': 'Workspace Lenses',
  'sparse-autoencoders': 'Sparse Autoencoders',
};

const mail = `[${SUPPORT_EMAIL}](mailto:${SUPPORT_EMAIL})`;

/** The ways to contribute, each with its sub-items. */
export const CONTRIBUTE_WAYS: ContributeWay[] = [
  {
    id: 'guidelines',
    title: 'Guidelines',
    text: `Be careful to direct your AI and review its work to ensure you're submitting something that makes sense. Common-sense guidelines are detailed in our [Terms of Service](/terms) and [Privacy Policy](/privacy). We vet all submissions to check for signs of cheating, like training directly against evaluation samples.`,
  },
  {
    id: 'ai-agents',
    title: "OpenAudit's AI Agent Prompt",
    text: `The agent reads our [guide for AI agents](${NEXT_PUBLIC_URL}${AGENT_GUIDE_PATH}). First it asks about your goal, your budget, your level and your field, so that it can explain at the right level. Then it finds the research that exists, on OpenAudit and outside, and helps you choose and refine an idea before it builds anything.

    For incidents and commitments, the agent only asks questions and writes the text for the [Submit form](/submit).`,
    action: 'paths',
  },
  {
    id: 'model-evaluations',
    title: 'Model Evaluations',
    text: `Our evaluations are currently [Inspect](https://inspect.aisi.org.uk/) tasks, but we're open to evaluations from other frameworks. Our agent prompt can also help you convert evaluations to be compatible with OpenAudit.`,
    items: [
      {
        id: 'submit-evaluations',
        title: 'Existing Evaluations',
        text: 'Know an evaluation that we should run? Use this [submit form](/submit?type=evaluation) to suggest it, with a link to its paper, code or data. Your agent can also port an existing evaluation to OpenAudit with you.',
        prompt: 'modelEvaluationExisting',
      },
      {
        id: 'create-evaluations',
        title: 'New Evaluations',
        text: `Your agent can help you design, build and test a new evaluation, then submit it as a pull request. Read [the guide](${REPO_URL}/tree/main/submissions/evals).`,
        prompt: 'modelEvaluationNew',
      },
      {
        id: 'private-evaluations',
        title: 'Private Evaluations',
        text: `If all or part of your evaluation must stay private (for example a held-out set), choose "Partly private" or "Private" in the Submit form. We then agree with you how to run it, and the private parts can stay with you.`,
        action: 'private',
      },
      {
        id: 'embedded-evaluations',
        title: 'Embedded Evaluations',
        text: `If you have special access to models, for example pre-release models or private weights, you can run our evaluations there and share the results that you are allowed to share. Contact us to plan it.`,
        action: 'contact',
      },
      {
        id: 'improve-evaluations',
        title: 'Improve Evaluations',
        text: `Some evaluation items have errors, such as a wrong answer key, or a scorer that marks a good reply as failed. The items that the most models fail are the best place to look. Your agent can find these items, check them against the source dataset, and write a report with you.`,
        prompt: 'evalErrors',
      },
    ],
  },
  {
    id: 'safety-methods',
    title: 'Safety Methods',
    text: '',
    items: [
      {
        id: 'methods-variants',
        title: 'Methods and Variants',
        text: '',
        items: [
          {
            id: 'method-variants',
            title: 'New Variant of an Existing Method',
            text: 'Start here to research and build your variant. Your agent then finds the path below that fits.',
            prompt: 'variant',
            items: [
              {
                id: 'variant-evaluated',
                title: 'OpenAudit Has an Evaluation for It',
                text: "We currently have method evaluations for these methods. The following are instructions for how to run these evaluations for your submission, though if you're using our agent prompt, it should automatically do it.",
                links: Object.keys(HARNESSES).map((slug) => [METHOD_NAMES[slug] ?? slug, submitPath(slug)]),
              },
              {
                id: 'variant-not-evaluated',
                title: "OpenAudit Doesn't Have an Evaluation for It",
                text: 'Use this [submit form](/submit?type=method) to send your variant.',
              },
            ],
          },
          {
            id: 'new-methods',
            title: 'New Method',
            text: '',
            items: [
              {
                id: 'method-evaluated',
                title: 'OpenAudit Has an Evaluation for It',
                text: 'For example, a new kind of lie detector or SAE. Your agent finds the evaluation that fits.',
                prompt: 'newMethod',
              },
              {
                id: 'method-not-evaluated',
                title: "OpenAudit Doesn't Have an Evaluation for It",
                text: 'Use this [submit form](/submit?type=method) to send your method, or [build an evaluation](#method-evaluations) for it.',
              },
            ],
          },
        ],
      },
      {
        id: 'method-evaluations',
        title: 'Method Evaluations',
        text: `A method evaluation tests safety methods, such as probes, lenses or SAEs, instead of models. Send it as a harness in a pull request, or suggest one with the Submit form.`,
        links: [
          ['Guide', `${REPO_URL}/tree/main/submissions/harnesses`],
          ['Template', `${REPO_URL}/tree/main/submissions/harnesses/_template`],
          ['Submit Form', '/submit?type=evaluation&tests=methods'],
        ],
        prompt: 'methodEvaluation',
      },
    ],
  },
  {
    id: 'commitments-incidents',
    title: 'Incidents and Commitments',
    text: `**Do not give sensitive data to an AI agent,** for example private chats, health data, other people's personal data, confidential data from work, or a security flaw that is not fixed yet. Write that report in the form yourself. For a security flaw that is not fixed, tell the organization first.`,
    items: [
      {
        id: 'submit-incidents',
        title: 'Incidents',
        text: 'Use this [submit form](/submit?type=incident) to report an incident, or use the prompt below for a guided flow.',
        prompt: 'incident',
      },
      {
        id: 'submit-commitments',
        title: 'Commitments',
        text: 'Use this [submit form](/submit?type=other) to send a safety commitment, or use the prompt below for a guided flow.',
        prompt: 'commitment',
      },
    ],
  },
  {
    id: 'other',
    title: 'Other Ways to Contribute',
    text: '',
    items: [
      {
        id: 'safety-collaborations',
        title: 'Safety Collaborations',
        text: `If your organization does AI safety evaluations or research and wants to work with us, email ${mail}.`,
      },
      {
        id: 'submit-ideas-suggestions',
        title: 'Ideas and Suggestions',
        text: 'Use this [submit form](/submit?type=other) to submit ideas and suggestions.',
      },
      {
        id: 'report-errors',
        title: 'Report Errors and Issues',
        text: 'Use this [submit form](/submit?type=other) to report an error, with a link to the page.',
      },
      {
        id: 'advisor',
        title: 'Be or Refer an Advisor',
        text: `We look for advisors in AI safety, evaluation and policy, to help keep our work correct and independent. If you can be one, or you know a person who can, email ${mail}.`,
      },
      {
        id: 'donations',
        title: 'Donations are Welcome',
        text: `Use this [donation page](${DONATE_URL}) to donate. Donations pay for runs and for our work. They go to our fiscal sponsor, a US 501(c)(3) public charity, and are tax-deductible as far as the law allows.`,
      },
    ],
  },
];
