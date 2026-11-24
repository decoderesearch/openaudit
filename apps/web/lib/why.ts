// The reasons on the Features page (`app/features/page.tsx`). The site assistant reads them too
// (`lib/ask/knowledge.ts`). The guided tour tells the same reasons, step by step (`lib/why-tour.ts`).

/** A reason: a feature. `head`: the name at the start of its panel. `problem`, `solution`, `examples`
 * and `caveats`: Markdown for the parts of the panel; an empty part shows nothing. `title` and `text`:
 * shown under the solution if not empty. */
export type Reason = {
  id: string;
  head: string;
  title?: string;
  problem: string;
  solution: string;
  examples: string;
  caveats?: string;
  text?: string;
};

/** The reasons, one in each cell of the grid. */
export const WHY_REASONS: Reason[] = [
  {
    id: 'evaluations',
    head: 'Explore Safety Evaluations',
    title: '',
    problem: `Today, safety evaluations and data are hard to find, disorganized, and often incomplete.`,
    solution: `OpenAudit is a central place to [browse and analyze evaluations](/models) in a consistent, structured way. It shows [evaluation types](/evaluations/agentharm) with the models that did best and worst, each model's [evaluation run](/runs/1CfkcdDC6KkBvEc5boxFdy), every [attempt](/runs/1CfkcdDC6KkBvEc5boxFdy/attempts/77), and its full [transcript](/runs/1CfkcdDC6KkBvEc5boxFdy/attempts/77).`,
    examples: `- **See Unsafe Model Behavior**: On the two-year-old [AgentHarm](/evaluations/agentharm) evaluation, DeepSeek still does very poorly. In [this flagged attempt](/runs/1CfkcdDC6KkBvEc5boxFdy/attempts/77), it facilitates human trafficking; you can read why it was flagged, then the whole transcript.

    - **Find Errors in Evaluation Data**: By re-examining the attempts that most models failed, we've confirmed [170+ errors across five evaluations](/evaluations/known-errors). We don't let these known errors affect a model's score, and we reported them to the evaluations' authors. There are likely more.
    `,
    caveats: `- **AI Safety Needs Better Evaluations** - Many public evaluations are older than the models they test, so a model may have already seen them, like an answer key, or may know that they're evaluation questions. Positive results are then not a meaningful safety signal, so we hope you'll help [build and submit better ones](/contribute#model-evaluations).`,
    text: ``,
  },
  {
    id: 'independence',
    head: 'Verify Claims Independently',
    title: '',
    problem: `Today, we rely heavily on trusting organizations to rate the safety of their own AI models. These self-rated reports, called [system cards](/google/gemini-3.1-flash-lite?tab=system-card), come from only a handful of organizations; others delay or report nothing. Google's Gemini 3.1 report, for example, is missing many areas of safety coverage.`,
    solution: `OpenAudit publishes [independently-verified safety cards](/google/gemini-3.1-flash-lite) by running evaluations against the models ourselves. We show a [rating from 0% to 100%](/faqs#percentage) from a panel of AI judges who see the results and answer: "Should this model be widely deployed, based on its safety evaluations and capabilities?" Gemini 3.1 gets 15%, because all nine judges disapproved of its deployment, even Google's own Gemini Argon.`,
    examples: `- **Proof of Unsafe Behavior** - OpenAudit lets you browse [flagged, unsafe conversations](/google/gemini-3.1-flash-lite#flagged-chats) and read their full transcripts. Gemini 3.1 Flash, for example, [supported random acts of violence](/runs/1CfkeqWp4jBx5Yj5y6M6S3/attempts/195?snippet=01a1629f-78ee-7905-8839-26f4c83cbbeb), planned an [attack on the White House](/runs/1CfgsngrU2KnJ98YcJ4zZm/attempts/79?snippet=01a16141-7b94-7577-ba8f-1d437e850749), and gave detailed instructions on [building a nuclear weapon](/runs/1CfgsngrU2KnJ98YcJ4zZm/attempts/59?snippet=01a16141-2a4f-74da-bf5a-5214b4c70855).`,
    caveats: `- **A High Rating Is Not "Safe"** - Current model evaluations are often outdated and underpowered, so a high rating does not mean a safe model.

    - **Conflict of Interest** - OpenAudit is a non-profit project, funded by [donors with conflicting interests](/faqs#funding). For example, we received interpretability-focused grants from Anthropic, but we also audit Anthropic's models and the organization itself. Anthropic has no review of, or veto over, what we publish about it.`,
    text: ``,
  },
  {
    id: 'safety-coordination',
    head: 'Track Safety Commitments',
    title: '',
    problem: `AI organizations sometimes claim they'll "agree to slow down potentially dangerous research, if everyone else does." These statements are often informal, lack details, and aren't verifiable.`,
    solution: `OpenAudit's [safety commitments dashboard](/organizations/commitments) tracks commitments across major labs and organizations. [Scoring each one](/faqs#commitments) on its concrete policy and whether it can be independently verified increases clarity for the public, and can reduce friction for organizations that want to coordinate on practical safety agreements.`,
    examples: `- **Comparing a Commitment**: [R&D Pacing and Coordination](/organizations/commitments/rd-pause) shows how far each organization has committed. Microsoft and OpenAI rank highest, yet still below a passing level, and no cell has a green ring, so none of these commitments have been independently verified.

    - **Many Claims, Few Verifications**: In [Anthropic's R&D Pacing commitment](/anthropic/commitments/rd-pause), many entries read as proposals rather than actual policy, and even the partial claims are unverified.
    `,
    caveats: ``,
    text: ``,
  },
  {
    id: 'research-coordination',
    head: 'Scale Safety Research',
    title: '',
    problem: `Many people (and their capable AI agents) want to help advance AI safety, but either don't know how to make valuable contributions, or don't have time for a full-time fellowship. Another bottleneck is too few human mentors, who themselves have full-time jobs.`,
    solution: `OpenAudit's [How to Contribute](/contribute) gives you an AI-powered scaffold for building, testing, and contributing [evaluations](/models) and [safety methods](/methods), customized to your experience level, budget, and time. For novices it is educational and "choose-your-own-adventure"; for advanced users it is flexible enough for ambitious, novel research.`,
    examples: `- **Novice-Friendly: Model Evaluations** - [Building better evaluations](/contribute#create-evaluations) is "low-hanging fruit", largely because of the gap between the [dire need for them](/faqs#outdated) and the few people working on them. It is doable even for novices who keep a high level of attention to detail.

    - **Advanced: Safety Methods** - OpenAudit hosts white-box and black-box [safety methods](/methods) (like Jacobian Lens and probes) anchored on reproducible evaluations as the judge. People and their AI agents can [hill-climb](https://en.wikipedia.org/wiki/Hill_climbing) to better methods, or add new method evaluations. A method evaluation targets either a safety goal or the best variant of one method. For example, [Varied Deception](/evaluations/varied-deception) ranks the best methods for detecting when a model lies across 32 models, and lets you sort samples to find where each method does best.
    `,
    caveats: `- **Not a Human Mentor Replacement** - Only human mentors have the proper experience, context, and connections to properly direct highly reliable and ambitious safety research.

    - **Risk of Slop** - As with any AI output, "vibe-researching" risks slop or delusion. Our prompt has guardrails, like frequent "reality checks" and review flows, that reduce (but don't remove) this risk.`,
    text: ``,
  },
  {
    id: 'shared-understanding',
    head: 'Share Incidents and Results',
    title: '',
    problem: `There's currently no agreed-upon home for sharing safety-related research and incidents in a structured way. At best, you tweet about it and maybe add a colorful visual, with discoverability scattered across websites, blogs, and news reports.`,
    solution: `OpenAudit is a structured home for [safety incidents](/organizations) and research, so everyone can have a shared understanding and contribute more easily, including reporting new events. It assigns permanent identifiers to every entity (organizations, models, evaluations, commitments, and more) and saves their structured data, so you can link to the incident itself instead of a months-old screenshot of a tweet.`,
    examples: `- **Incident Summaries and Logs** - OpenAudit keeps a history of incidents like the [Hugging Face agent intrusion](/openai/incidents/2026-hugging-face-agent-intrusion), with a standard view of its history, released logs, event timeline, and sources. You can also [submit new incidents and reports](/submit?type=incident).

    - **Shareable, Consistent Links** - Identifiers combine into intuitive, readable, permanent, and tested URLs. \`anthropic\` is the [Anthropic organization](/anthropic) and \`independent-oversight\` is the [Independent Oversight](/organizations/commitments/independent-oversight) commitment, so Anthropic's version is simply [/anthropic/commitments/independent-oversight](/anthropic/commitments/independent-oversight).
    `,
    caveats: `For sensitive incident submissions, submitters should provide their own anonymity protections and familiarize themselves with local laws regarding whistleblower protections.`,
    text: ``,
  },
];
