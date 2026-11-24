import { WHY_REASONS } from '@/lib/why';

/** One step of a Why OpenAudit tour. `path`: the page, with its query. `target`: a CSS selector for
 * the element to highlight; with none, the popover is in the center. `heading`: the target is the
 * one whose first heading has this text (not case sensitive). `up`: highlight this many parents up
 * from the target. `end`: scroll the target's list to its end first. `part`: the part of the reason
 * that the step tells. `text`: HTML. `gated`: the target shows eval content, which needs the
 * reader's statement (see `AttestationForm`). `action`: the reader clicks the target to go to the
 * next step; the links in it do not work, but for the one that this selector finds. */
export type TourStep = {
  path: string;
  target?: string;
  heading?: string;
  up?: number;
  end?: boolean;
  part?: 'Problem' | 'Solution' | 'Examples' | 'Caveats';
  title?: string;
  text: string;
  gated?: boolean;
  action?: string;
};

/** The DeepSeek-V4-Flash-0731 run of AgentHarm. */
const RUN = '/runs/1CfkcdDC6KkBvEc5boxFdy';

/** The tour of each reason on the Why OpenAudit page, by the reason's `id`, in the page's order. The
 * full tour is these tours, one after the other. The first Solution step's title is the reason's head.
 * An action step has no `part`. */
export const WHY_TOURS: Record<string, TourStep[]> = {
  evaluations: [
    {
      path: '/models',
      part: 'Problem',
      text: `<p>Today, safety evaluations and data are hard to find, disorganized, and often incomplete.</p>`,
    },
    {
      path: '/models',
      target: 'section[aria-label="Evaluations"]',
      part: 'Solution',
      title: 'Explore Safety Evaluations',
      text: `<p>OpenAudit is a central place to browse and analyze evaluations in a consistent and structured way.</p><p>Here, we show multiple <strong>evaluation types</strong> and the models that did the best and worst on them.</p>`,
    },
    {
      path: '/models',
      target: 'section[aria-label="Evaluations"] li:has(a[href="/evaluations/agentharm"])',
      action: 'a[href="/evaluations/agentharm"]',
      text: `<p>Let's check out one of the <strong>evaluation types</strong>. Click AgentHarm.</p>`,
    },
    {
      path: '/evaluations/agentharm',
      target: 'section#runs',
      part: 'Examples',
      title: 'Evaluation Type',
      text: `<p>Each model evaluation type, like AgentHarm, has its own page. The page ranks the AI models that we ran this evaluation against, how they did, and how many chats we flagged for safety reasons during that evaluation.</p>`,
    },
    {
      path: '/evaluations/agentharm',
      target: 'section#runs [data-outdated-note]',
      part: 'Caveats',
      title: 'AI Safety Needs Better Evaluations',
      text: `<p>The warning here tells us that this evaluation is older than the models it's testing. This means the models could have seen the evaluation already, like seeing the answer key to a test, or could know that these are evaluation questions. Therefore, positive results here are not a meaningful indicator of a model's safety.</p><p>AI safety needs better and newer evaluations - we hope you'll help build and submit them to OpenAudit.</p>`,
    },
    {
      path: '/evaluations/agentharm',
      target: `section#runs tr:has(a[href="${RUN}"])`,
      end: true,
      action: `a[href="${RUN}"]`,
      text: `<p>Despite this evaluation being two years old, it looks like DeepSeek still did very poorly on it. Let's click to see the details of its <strong>evaluation run</strong>.</p>`,
    },
    {
      path: RUN,
      target: 'section',
      heading: 'Headline Metric',
      up: 1,
      part: 'Examples',
      title: 'Evaluation Run',
      text: `<p>Each evaluation run is an evaluation that was "run" on a model, and the run page contains detailed metrics. These are DeepSeek's metrics for each subcategory, like copyright, cybercrime, and disinformation.</p>`,
    },
    {
      path: RUN,
      target: 'section#samples',
      part: 'Examples',
      text: `<p>Evaluation run pages also show how the model did on each <strong>evaluation attempt</strong>.</p><p>DeepSeek seems to have failed on many of them.</p>`,
    },
    {
      path: RUN,
      target: `section#samples tr:has(a[href="${RUN}/attempts/77"])`,
      action: `a[href="${RUN}/attempts/77"]`,
      text: `<p>Click the "trafficking facilitation" evaluation attempt.</p>`,
    },
    {
      path: `${RUN}/attempts/77`,
      target: '#flag',
      part: 'Examples',
      title: 'Evaluation Attempt',
      text: `<p>Read the summary of why this evaluation attempt was flagged as unsafe model behavior.</p>`,
    },
    {
      path: `${RUN}/attempts/77`,
      target: '[data-message][data-flagged]',
      part: 'Examples',
      title: 'Evaluation Transcript',
      gated: true,
      text: `<p>You can review the whole attempt's transcript and confirm that the model did indeed do the harmful thing and follow how it occurred.</p>`,
    },
    {
      path: '/evaluations/known-errors',
      target: 'main table',
      part: 'Examples',
      title: 'Finding Evaluation Data Errors',
      gated: true,
      text: `<p>Evaluations are far from perfect and contain errors. OpenAudit helps spot these errors: after running and examining evaluation results where most models failed, we quickly confirmed over 170 errors across five evaluations.</p><p>We don't let these known errors affect a model's score, and we reported them to the evaluations' authors.</p>`,
    },
  ],
  independence: [
    {
      path: '/google/gemini-3.1-flash-lite?tab=system-card',
      part: 'Problem',
      text: `<p>Today, we rely heavily on trusting organizations to rate the safety of their own AI models.</p>`,
    },
    {
      path: '/google/gemini-3.1-flash-lite?tab=system-card',
      target: 'section',
      heading: 'Evaluation Categories',
      part: 'Problem',
      title: 'Missing, Partial, and Unverified Safety Reports',
      text: `<p>An organization's self-rated safety reports are called "System Cards". Only a handful of organizations publish them, while others delay or don't report anything at all.</p><p>Here, we see that Google's Gemini 3.1 system report is missing many areas of safety coverage.</p>`,
    },
    {
      path: '/google/gemini-3.1-flash-lite',
      target: '#deploymeter',
      part: 'Solution',
      title: 'Verify Claims Independently',
      text: `<p>OpenAudit publishes independently-verified safety cards for models by running evaluations against the models.</p><p>We show a rating from 0% to 100% from a panel of AI judges who see the evaluation results and answer: "Should this model be widely deployed, based on its safety evaluations and capabilities?" A high rating does not mean a safe model, because current evaluations are often outdated and underpowered.</p><p>Here, we see a 15% rating for the same Gemini 3.1 model, because all nine AI judges disapproved of the model's deployment. Even Google's other AI model, Gemini Argon, disapproved of Gemini 3.1's wide deployment.</p>`,
    },
    {
      path: '/google/gemini-3.1-flash-lite',
      target: '#flagged-chats',
      part: 'Examples',
      title: 'Proof of Unsafe Behavior',
      text: `<p>OpenAudit lets you browse flagged/unsafe conversations from a model and view their full transcripts. Here, we see Gemini Flash 3.1 has no problem advocating for various unsavory things.</p>`,
    },
    {
      path: '/google/gemini-3.1-flash-lite',
      part: 'Caveats',
      title: 'Conflict of Interest',
      text: `<p>OpenAudit is a non-profit project, funded by donors with conflicting interests. For example, we received interpretability-focused grants from Anthropic, but we also audit Anthropic's models and the organization itself.</p><p>Anthropic has no review of, or veto over, what we publish about it.</p>`,
    },
  ],
  'safety-coordination': [
    {
      path: '/organizations/commitments',
      part: 'Problem',
      text: `<p>AI organizations sometimes claim they'll "agree to slow down potentially dangerous research, if everyone else does." These statements are often informal, lack details, and aren't verifiable.</p>`,
    },
    {
      path: '/organizations/commitments',
      target: 'main table',
      part: 'Solution',
      title: 'Track Safety Commitments',
      text: `<p>OpenAudit's safety commitments dashboard tracks safety commitments across major labs and organizations, increasing clarity for the public, and potentially reducing friction for organizations who wish to coordinate on practical safety agreements.</p>`,
    },
    {
      path: '/organizations/commitments',
      target: 'main table a[href="/organizations/commitments/rd-pause"]',
      up: 1,
      action: 'a[href="/organizations/commitments/rd-pause"]',
      text: `<p>Let's check out one of these <strong>commitments</strong>. Click Research and Development (R&D) Pacing and Coordination.</p>`,
    },
    {
      path: '/organizations/commitments/rd-pause',
      target: 'section[aria-label="Organizations"]',
      part: 'Examples',
      title: 'Comparing a Safety Commitment',
      text: `<p>Here, we see organizations and how much they've committed to each of the aspects of R&D Pacing and Coordination. Microsoft and OpenAI have the highest levels of commitment, which are still below a passing level. Since no cell has a green circle around it, none of the commitments made by any organizations here have been independently verified.</p>`,
    },
    {
      path: '/organizations/commitments/rd-pause',
      target: 'section[aria-label="Organizations"] a[href="/anthropic/commitments/rd-pause"]',
      up: 1,
      action: 'a[href="/anthropic/commitments/rd-pause"]',
      text: `<p>Let's view the full details of Anthropic's safety commitment on R&D Pacing. Click "Anthropic".</p>`,
    },
    {
      path: '/anthropic/commitments/rd-pause',
      target: 'main table',
      part: 'Examples',
      title: 'Many Claims, But No Verifications',
      text: `<p>Here, according to the cited sources, we see that while Anthropic has made some partial commitments to R&D pacing, many seemed to be proposals rather than actual policy, and even these partial claims have not been verified by independent parties.</p>`,
    },
  ],
  'research-coordination': [
    {
      path: '/contribute',
      part: 'Problem',
      text: `<p>Many people want to help advance AI safety, but either don't know how to make valuable contributions, or don't have time to do a full-time fellowship.</p><p>Another bottleneck is that there are too few human mentors, who themselves have full-time jobs.</p>`,
    },
    {
      path: '/contribute',
      target: '#tldr',
      part: 'Solution',
      title: 'Scale Safety Research',
      text: `<p>OpenAudit gives you an AI-powered scaffold for building, testing, and contributing to AI safety, customized to your experience level, budget, and time.</p><p>For novices, the scaffold is educational and "choose-your-own-adventure", and for advanced users, the scaffold is flexible enough to assist with ambitious, novel research.</p><p>As with any AI output, this risks slop or delusion, so the scaffold has guardrails, like frequent "reality checks" and review flows.</p>`,
    },
    {
      path: '/contribute',
      target: '#create-evaluations',
      part: 'Examples',
      title: 'Novice-Friendly Contributions: Model Evaluations',
      text: `<p>Building better new model evaluations is, relatively speaking, "low-hanging fruit", partly due to the gap between the dire need for them and the amount of people working on them.</p><p>These are fairly doable even for novices, as long as they maintain a high level of attention to detail.</p>`,
    },
    {
      path: '/methods',
      target: 'section[aria-label="Evaluations"]',
      part: 'Examples',
      title: 'Advanced: Safety Methods and Evaluations',
      text: `<p>For those with research and technical experience, OpenAudit accepts new white-box and black-box <strong>safety methods</strong> (like Jacobian Lens and probes) anchored on reproducible evaluations. This lets people "hill-climb" to better safety methods, or add new method evaluations.</p><p>Here, we see the list of safety method evaluations, and what the best known methods are for them. Each one targets either a safety goal, like detecting deception, or the best variant of one method.</p>`,
    },
    {
      path: '/methods',
      target: 'section[aria-label="Evaluations"] li:has(a[href="/evaluations/varied-deception"])',
      action: 'a[href="/evaluations/varied-deception"]',
      text: `<p>Let's check out a safety method evaluation that tests how well methods can detect when an AI lies.</p><p>Click "Varied Deception".</p>`,
    },
    {
      path: '/evaluations/varied-deception',
      target: 'section#runs',
      part: 'Examples',
      title: 'Method Evaluations - Rankings',
      text: `<p>Each method evaluation has a leaderboard ranking of the best methods.</p><p>For this Varied Deception evaluation, the Chain-of-Thought Judge is the best method for detecting lies across 32 models, compared to five other methods.</p>`,
    },
    {
      path: '/evaluations/varied-deception',
      target: 'section#samples',
      part: 'Examples',
      title: 'Method Evaluations - Samples',
      text: `<p>You can browse, filter, and sort the evaluation samples. By default, we sort by the most "failed" to least failed, to quickly surface the samples that all methods and models did the worst on.</p>`,
    },
  ],
  'shared-understanding': [
    {
      path: '/organizations',
      part: 'Problem',
      text: `<p>There's currently no agreed-upon home for sharing safety-related research and incidents in a structured way.</p><p>For sharing, at best, you tweet about it and maybe add a colorful visual. Discoverability is scattered across websites, blogs, and news reports.</p>`,
    },
    {
      path: '/organizations',
      // The list only, not the organizations in its head.
      target: 'section[aria-label="Latest Incidents"] [data-feed-list]',
      part: 'Solution',
      title: 'Share Incidents and Results',
      text: `<p>OpenAudit is a home for safety incidents and research, allowing everyone to have a shared understanding and contribute more easily, including reporting new events.</p><p>Instead of a months-old screenshot of a tweet, you can link to the incident itself, with its structured data saved permanently.</p>`,
    },
    {
      path: '/organizations',
      // `:not(:has(ul))`: the one incident row, not the day's wrapper that also holds its departures.
      target:
        'section[aria-label="Latest Incidents"] li:has(a[href="/openai/incidents/2026-hugging-face-agent-intrusion"]):not(:has(ul))',
      action: 'a[href="/openai/incidents/2026-hugging-face-agent-intrusion"]',
      text: `<p>Let's check out one of the <strong>incidents</strong>. Click this model hacking incident.</p>`,
    },
    {
      path: '/openai/incidents/2026-hugging-face-agent-intrusion',
      target: '#summary',
      up: 1,
      part: 'Examples',
      title: 'Incident Summaries and Logs',
      text: `<p>On an incident's page, we see a detailed history of the incident, including the specific logs that were released, as well as an event timeline and sources.</p>`,
    },
    {
      path: '/submit?type=incident',
      target: '#submit-form',
      part: 'Examples',
      title: 'Submit Incidents and Reports',
      text: `<p>OpenAudit accepts submissions of new incidents and reports.</p><p>For sensitive incidents and logs, submitters should provide their own anonymity (e.g. VPNs) as we cannot guarantee it, and also familiarize themselves with local laws regarding whistleblower protections.</p>`,
    },
    {
      path: '/organizations/commitments/independent-oversight',
      // Phones have no breadcrumb bar: then the page title.
      target: 'nav[aria-label="Breadcrumb"], main h1',
      part: 'Examples',
      title: 'Shareable, Consistent Links',
      text: `<p>OpenAudit assigns identifiers to every entity: organizations, models, evaluations, commitments, etc.</p><p>These identifiers are combinable to make readable, permanent, and tested links. For example, the link for organizations' commitments for Independent Oversight is <code>/organizations/commitments/independent-oversight</code>.</p>`,
    },
  ],
};

/** The short tour: one step for each reason, with its head and its solution text without links. The
 * step's page is the solution's first link. It highlights what the reason's tour first highlights
 * on that page. */
export const SHORT_TOUR: TourStep[] = WHY_REASONS.flatMap((r) => {
  const path = /\]\(([^)\s]+)\)/.exec(r.solution)?.[1];
  const tour = WHY_TOURS[r.id];
  if (!path || !tour) return [];
  const shown = tour.find((s) => s.path === path && s.target && !s.action);
  const { target, heading, up, end, gated } = shown ?? {};
  return [
    {
      path,
      ...(target && { target, heading, up, end, gated }),
      title: r.head,
      text: `<p>${r.solution.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')}</p>`,
    },
  ];
});
