/** A question on the FAQs page. `id`: its anchor. `answer`: Markdown, for example [text](/page) or
 * [text](https://...); a blank line starts a new paragraph, and backticks (`...`) hold more than
 * one line (the indent of the code does not count). An empty answer shows only the question. */
export type Faq = { id: string; question: string; answer: string };

/** On the FAQs page, and in the "How This Works" modal of the commitments page. */
export const COMMITMENTS_FAQ: Faq = {
  id: 'commitments',
  question: 'What are organization safety commitments and how are they scored?',
  answer: `An organization's [safety commitments](/organizations/commitments) are policies or processes they've publicly committed to. For example, an organization can commit to having [Embedded Evaluators](/organizations/commitments/embedded-evaluators), which are external people given internal access to observe and report on potential issues.

  We assign "commitment points" to an organization based on how many aspects of the commitment are fulfilled. For [Embedded Evaluators](/organizations/commitments/embedded-evaluators), one aspect is \"Free Publication\": organizations cannot block non-confidential information from reports. Here, both [OpenAI](/openai/commitments/embedded-evaluators) and [Anthropic](/anthropic/commitments/embedded-evaluators) get half a point, because while there is some freedom for evaluators to publish, both organizations can (reportedly) redact evidence.

  Commitments are far less meaningful if they cannot be independently verified, so if an organization does not allow this verification, they only get half the point value. For example: Microsoft's [R&D Pacing and Coordination](/microsoft/commitments/rd-pause) commitment says they'll pause development if a risk cannot be sufficiently mitigated. This is worth one full point. However, since they've not agreed to external verification, they get half a point for it.
  `,
};

/** A section of the FAQs page. `id`: its anchor. */
export type FaqSection = { id: string; title: string; faqs: Faq[] };

/** The sections and their questions (see `Faq`), in order. `id`: the anchor. */
export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'general',
    title: 'General',
    faqs: [
      {
        id: 'who',
        question: 'Who runs OpenAudit and is it a non-profit?',
        answer: `OpenAudit is run by Decode Research, a non-profit project fiscally sponsored by Players' Philanthropy Fund. Decode Research also runs [Neuronpedia](https://neuronpedia.org) and maintains other [interpretability projects](https://github.com/decoderesearch).`,
      },
      {
        id: 'why',
        question: 'Why OpenAudit?',
        answer: `
        See [Why OpenAudit?](/features)
        `,
      },
      {
        id: 'funding',
        question: 'Who funds OpenAudit?',
        answer: `
        Unfortunately, in our current pre-post-scarcity society, doing things like renting web servers to run evaluations costs money.
        
        The non-profit that runs OpenAudit (Decode Research) has received donations and grants from Coefficient Giving (prev Open Philanthropy), Anthropic Interpretability, the Survival and Flourishing Fund, and others. These donations were given when Decode Research was only doing interpretability projects.

        There is a clear conflict of interest: we received interpretability-focused grants from Anthropic, but we also audit Anthropic's models and the organization itself (including its commitments and safety incidents). Anthropic has no review of, or veto over, what we publish about it. We have not agreed to avoid evaluations of any organization, or of any topic.
        
        We realize that using funding from *any* source raises reasonable questions about bias and impartiality, so we're open to taking suggestions on alternative strategies here. If you've got ideas, we're also [looking for advisors](/contribute#advisor) if you'd like to be one!
        `,
      },
      {
        id: 'sources',
        question: 'Where is data sourced from?',
        answer: `
        Data comes from either publicly available sources (often summarized/organized with AI), or from running code and evaluations ourselves. We'd like to add more sources, like private evaluations, external evaluator reports, and user-submitted safety methods and evaluations. Submit your [suggestions](/contribute#submit-ideas-suggestions) and [evaluations](/contribute#model-evaluations).

        | Data Type | Current | Ideal |
        | --- | --- | --- |
        | **Model Evaluations** | Public sources like Hugging Face | Add private evaluations (evaluations where dataset is hidden from the public) and external evaluations (evaluations run by other organizations and auditors) |
        | **Model Evaluation Runs** | We run them to ensure integrity. | Integrate and/or aggregate external evaluators' runs. |
        | **Model and Organization Data** | Public sources like system cards or news reports. | Similar to current, but ideally with more and better-verified disclosures on [incidents](/organizations/commitments/misalignment-disclosures) and [internal deployments](/organizations/commitments/internal-deployment-disclosure). |
        | **Methods and Evaluations** | Publicly available sources like GitHub, arXiv, etc. | Add user and organization submitted methods and method evaluations. |
        `,
      },
      {
        id: 'too-many-things',
        question: 'OpenAudit hosts evaluations of models, organizations, and methods. Is this too many things?',
        answer: `This is a real risk, and it is indeed difficult to design a platform with both breadth and depth, while remaining uncluttered and not alienating too many people. For example, while [safety commitments](/organizations/commitments) are easily understood by everyone, OpenAudit's more [technical parts](/methods/sparse-autoencoders/matryoshka-batchtopk) could be confusing to many audiences.

        We've designed OpenAudit to be a "choose your own content and technical level" experience, and we think having all of these things in one place strengthens the platform, because models, organizations, and methods all contribute to the overall question of how prepared we are to develop and release AI safely. There are significant overlaps: questions that one might have about an organization naturally lead to questions about the models they're making. And model-related questions naturally lead to questions about the reliability of safety methods used to evaluate those models. We hope OpenAudit encourages people (assisted by their favorite AI) to dig deeper.

        The technical case for combining model evaluations and safety methods also seems fairly sound: if someone's looking at a white-box safety method that detects deception, and it seems to not work very well on a specific model, it's quite relevant to be able to view that model's black-box deception evaluations, for example its evaluation transcripts and performance.

        We're open to reducing scope later on if this turns out to not be optimal.
        `,
      },
      COMMITMENTS_FAQ,
      {
        id: 'clear-gaps',
        question: 'What are some gaps and shortcomings of OpenAudit?',
        answer: `There are many, we'll highlight a few below. Some gaps have a plan, some could use your suggestions/ideas. Most shortcomings have to do with model evaluations. Please [submit other gaps and shortcomings](/contribute#submit-ideas-suggestions).
        
        | Gap | Description | Plan |
        | --- | --- | --- |
        | **OpenAudit is Doing Too Many Things** | Covering models, organizations, and methods, as well as their evaluations could result in user confusion and target too broad an audience. | See [Too Many Things](/faqs#too-many-things). |
        | **Bad Model Evaluations** | We currently host our evaluations from public sources, which are generally outdated and inadequate tests for modern models. | Add private evaluations and external evaluations. |
        | **Private/Internal Models are Likely More Important** | OpenAudit currently focuses on evaluating public models, with private models as imported ["incidents"](/openai/incidents/2026-research-model-prompt-injected-graders-in-filenames) only when an organization has voluntarily disclosed them. Many frontier organizations now are pursuing "Recursive Self Improvement" ([RSI](/organizations/commitments/rsi-development)), where they use their best internal models to build even more capable models. These models are unlikely to be released publicly, since organizations wish to "win the AI race". So focusing on evaluating public models could be a distraction. | Most solutions to this require changes to [organization commitments](/organizations/commitments), which currently prevent sufficient access and analysis of internal models. [Embedded evaluators](/organizations/commitments/embedded-evaluators) need access to internal models to properly test them. |
        | **Poor Tooling: Large Transcripts** | Realistic agentic misbehavior can involve giga/terabytes of logs for just one scenario. OpenAudit could be building significantly better tools targeted to analyzing logs of that size. OpenAudit also doesn't have access to these logs. | For tooling support, we're working on it and it doesn't seem difficult. For these scenarios, OpenAudit is not yet the end-to-end tool for root causing - we aim to first host the broader conclusions and highlights of these evaluations, then provide specific tools as needed. For access, we accept [public submissions](/contribute#submit-incidents), and more likely, we should collaborate with organizations that already have this data, whether they're evaluators or model developers. Organizations could also commit to full evidence release in [misalignment disclosures](/organizations/commitments/misalignment-disclosures).|
        | **Unfair Advantage for Closed Weight Models** | Closed weight models are accessible only via APIs, and these APIs often have additional safety filters and checks (not part of the model itself) that running a pure open weight model doesn't have. This gives closed weight models a better "pass" rate since their other filters often prevent the model itself from responding in undesirable ways. | This comes down to access. See above answer regarding organization commitments and embedded evaluators. |
        | **Safety Methods Evaluations Need More Variations** | Currently we make many assumptions when running safety method evaluations - for example, we might use a certain set of AI judges to rate the correctness of a safety method, but if we switched to a different set of judges, the outcome could be completely different. | The solution is to do multiple runs of each safety method evaluation, with different settings. This requires more resources and time, but could lead to higher confidence results. |
        | **"Vibe-Research" May Not Work (Yet)** | Our [AI agent prompt](/contribute#ai-agents) helps people use their AI to build safety projects end to end. As with any AI outputs, this risks slop or delusion. | We've built in guardrails, like frequent "reality checks" and review flows, and we'll continue to iterate on the prompt. [Tell us](/contribute#submit-ideas-suggestions) if it didn't work for you. |
        | **Missing Data and Metrics** | Many parts of OpenAudit exist, but aren't at their full potential yet. For example, safety methods are missing key metrics, and we're missing key historical AI safety incidents. | We add these as we can. You can [submit incidents](/contribute#submit-incidents) and [method evaluations](/contribute#method-evaluations). |
        | **OpenAudit Could Be Net Negative** | Some of our assumptions could be incorrect, or such a platform could be net negative to AI safety in a way that we have not thought of. | Please [tell us](/contribute#submit-ideas-suggestions) if you think so, and why. |
        `,
      },
      {
        id: 'contribute',
        question: 'How can I help, contribute, or make suggestions?',
        answer: `See [How to Contribute](/contribute).`,
      },
      {
        id: 'contact',
        question: 'How do I contact OpenAudit?',
        answer:
          'You can email us at [support@openaudit.com](mailto:support@openaudit.com), or [submit](/submit) something directly. We use the regular internet and third-party web servers and email servers with standard levels of security, so if you need something better than the defaults, you need to provide anonymity on your own side.',
      },
    ],
  },
  {
    id: 'evaluations',
    title: 'Evaluations',
    faqs: [
      {
        id: 'newest-models',
        question: 'Where are the evaluations for the newest models like Claude Fable and GPT Astra?',
        answer: `
        OpenAudit doesn't have model evaluations for the latest models like Claude Fable and GPT Astra, due to these limitations:

        ### Limitation: Outdated Evaluations
        Public model evaluations are outdated relative to the newest models, and there just aren't that many evaluations available. Running evaluations on these newer models would give a false sense of safety because the models have either already ingested the public evaluation's samples, or are smart enough to realize that they're under evaluation.

        ### Limitation: Lack of Direct Access
        The latest models are often closed weights and only accessible via API, so tests may not be evaluating the actual model itself, but the model plus the safeguards and filters they layer in front of it. This gives these models an unearned better rating when comparing with [our evaluations of DeepSeek V4](/deepseek-ai/DeepSeek-V4-Flash-0731), which has a rating of 25%.

        ### Proposed Solution: New, Private, and External Evaluations
        As outlined under [Contributions](/contribute#model-evaluations), we want to make it easy for anyone to [build new evaluations](/contribute#create-evaluations), [import existing ones](/contribute#submit-evaluations), and [submit private ones](/contribute#private-evaluations) that models haven't seen. We also want to host external evaluations, especially ones by [Embedded Evaluators](/contribute#embedded-evaluations), who can test a model without the safeguards in front of it.
        `,
      },
      {
        id: 'training',
        question: "Isn't it bad to host model evaluation data since models will be trained on them?",
        answer: `
        The evaluations we currently host are already publicly available by simple searches without any special access (this is how we got these evaluations in the first place), so bad-faith organizations that want to artificially increase their scores will have already done this.

        For organizations attempting to be legitimately compliant, we employ the following methods to protect against accidental scraping: First, viewing evaluation data requires an explicit opt-in on a user's first visit. This opt-in requires confirmation that the user is not an AI agent and that they will not train on this data. Second, we include canary GUIDs in as many places as we can, including the site footer on every page, evaluation sample pages, and evaluation run pages. Finally, we don't show evals whose authors ask that their data not be republished. If you've found an exception, please [report it](/contribute#report-errors).

        We plan on soon hosting private and semi-private evaluations. For these evaluations, we won't make the samples and run transcripts available publicly.
        `,
      },
      {
        id: 'outdated',
        question: "Aren't the model evaluations inaccurate, since they're older than most of the recent models?",
        answer:
          'Yes, yes they are. Model evaluation scores are likely higher than they would be if we had better evaluations. We need people to [build better evaluations](/contribute#model-evaluations).',
      },
      {
        id: 'percentage',
        question: 'Model evaluations show a percentage (%) rating. How is this calculated?',
        answer: `
        The rating answers one question: "Should this model be widely deployed, based on its safety evaluations and capabilities?" A high rating does not mean a "safe" model, because current model evaluations are often [outdated and underpowered](/faqs#newest-models).

        1. We run the evaluations against the model, which results in scores for each evaluation.
        2. We have another AI read each chat and flag the most concerning ones.
        3. We show a panel of nine AI judges, each from a different lab, an anonymized packet of the evaluation results and the flagged chats. Each judge gives the model a % score and a decision: Approve (70 to 100), Limited Approval (50 to 69), or Disapprove (0 to 49). A judge can also abstain.
        4. The final deploymeter score is the median of the judges' scores. Judges from the model's own lab review too, but their scores don't count.`,
      },
    ],
  },
];
