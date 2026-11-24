/* Generated from spec/schemas by spec/scripts/generate.mjs. Do not edit. */

/**
 * Any OpenAudit spec record. Optional fields are left out, never null. Ids are UUIDv7.
 */
export type SpecRecord =
  | Organization
  | Model
  | Document
  | Eval
  | EvalSuite
  | EvalVersion
  | EvalSample
  | SystemCard
  | EvalResult
  | EvalRun
  | EvalAttempt
  | Transcript
  | OpenAuditCardVersion
  | OpenAuditSnippet
  | OrgIncident
  | OrgIncidentEvent
  | OrgDeparture
  | Commitment
  | OrgCommitment
  | OrgCommitmentEvent
  | Method
  | MethodVariant
  | MethodExpertView
  | MethodArtifact
  | MethodResult;
/**
 * A UUIDv7, made by the client that creates the record. Lowercase, with dashes.
 */
export type Id = string;
/**
 * A lowercase name for URLs and lookups (`google`, `01-ai`).
 */
export type Slug = string;
/**
 * `hf`: weights on the Hugging Face Hub (or `local/<name>`). `api`: a model behind a provider API. The name alone can collide (`openai/gpt-oss-20b` is open), so the source is part of the identity.
 */
export type ModelSource = 'hf' | 'api';
/**
 * How a model comes from its parent, as the Hub's `base_model:<relation>:` tags.
 */
export type ParentRelation = 'quantized' | 'adapter' | 'finetune';
/**
 * A date only as exact as its source says (YYYY, YYYY-MM or YYYY-MM-DD).
 */
export type PartialDate = string;
/**
 * An http or https URL.
 */
export type Url = string;
export type Modality = 'text' | 'image' | 'audio' | 'video';
/**
 * What the document is. A system card and a safety report state the lab's tests. A model page is a short page about a model (specs and use), with no safety tests.
 */
export type DocumentKind = 'system_card' | 'technical_report' | 'safety_report' | 'model_page' | 'blog';
/**
 * `hf_benchmark`: a Hugging Face benchmark dataset repo, for Community Evals. `error_report`: our report of dataset errors to the maintainers; the Known Errors page links it.
 */
export type EvalLinkKind =
  'paper' | 'repo' | 'dataset' | 'hf_benchmark' | 'leaderboard' | 'homepage' | 'blog' | 'error_report';
/**
 * Who can get the samples. `public`: anyone. `gated`: after agreeing to the source's terms. `held_out`: kept back by the maintainer. `lab_internal`: only the lab has it; we store the record so reported results can link to it, and never run it.
 */
export type EvalAccess = 'public' | 'gated' | 'held_out' | 'lab_internal';
/**
 * `active`: current, and we recommend it. `saturated`: valid, but current models score at the ceiling or the floor. `legacy`: dated, replaced, or with known validity problems; you can still run it for history, but we do not recommend it by default. `retired`: withdrawn; do not run it.
 */
export type EvalStatus = 'active' | 'saturated' | 'legacy' | 'retired';
/**
 * `capability`: can the subject do it. `propensity`: does it tend to. `robustness`: can its safeguards be broken.
 */
export type Measures = 'capability' | 'propensity' | 'robustness';
export type EvalFormat = 'single_turn' | 'multi_turn' | 'agentic';
/**
 * `fixed`: a dataset. `generated`: an auditor model writes the conversation from a seed. `live_human`: people talk to the subject.
 */
export type EvalCases = 'fixed' | 'generated' | 'live_human';
export type Grading = 'programmatic' | 'model_judge' | 'human';
/**
 * What a run tests. `model`: a model. `auditor`: an agent (model, tools, scaffold) that audits target models. `method`: an interp method on a model, with its artifact (SAE, vector, probe).
 */
export type SubjectKind = 'model' | 'auditor' | 'method';
/**
 * What an eval is about. The same list tags system-card coverage.
 */
export type Topic =
  | 'harmful_requests'
  | 'child_safety'
  | 'self_harm'
  | 'jailbreaks'
  | 'prompt_injection'
  | 'agentic_misuse'
  | 'hallucination'
  | 'honesty'
  | 'sycophancy'
  | 'bias'
  | 'toxicity'
  | 'reward_hacking'
  | 'eval_awareness'
  | 'situational_awareness'
  | 'cot_monitorability'
  | 'sabotage'
  | 'manipulation'
  | 'power_seeking'
  | 'welfare'
  | 'cyber'
  | 'bio_chem'
  | 'auditing';
/**
 * `draft`: can change. `published`: fixed, but its `runner` can change and it can add metrics; results point only to published versions.
 */
export type EvalVersionStatus = 'draft' | 'published';
/**
 * Who can read sample text: inputs, targets, transcripts and logs. `open`: anyone. `sign_in`: signed-in users who accepted the dataset's terms on our site. `scores_only`: nobody; pages show only scores and pass or fail.
 */
export type DisplayRule = 'open' | 'sign_in' | 'scores_only';
/**
 * `binary`: 0 or 1 (pass). `ordinal`: whole steps from `min` to `max` (a 1-10 judge scale). `continuous`: any number, in `[min, max]` when given.
 */
export type ScoreType = 'binary' | 'ordinal' | 'continuous';
/**
 * `nearer_zero_is_better`: a signed number where 0 is best and both signs are worse.
 */
export type Direction = 'higher_is_better' | 'lower_is_better' | 'nearer_zero_is_better' | 'neither';
/**
 * How attempts become one number. `mean`: the mean of a score. `rate`: the share of attempts whose binary score is 1. `pass_at_k`: pass@k over trials. `custom`: the eval's own formula (see `description`).
 */
export type MetricAggregation = 'mean' | 'rate' | 'pass_at_k' | 'custom';
/**
 * `inspect`: an Inspect task. `openaudit`: our runner. `external`: the maintainer's own code.
 */
export type RunnerKind = 'inspect' | 'openaudit' | 'external';
/**
 * A model's part in a run, as Inspect's `model_roles`. `target`: the model under test. `auditor`: writes the other side of the conversation. `judge`: scores. `monitor`: watches the target for bad actions. `generator`: writes samples.
 */
export type ModelRole = 'target' | 'auditor' | 'judge' | 'monitor' | 'generator';
export type LabPrefix = string;
/**
 * A model the card covers. `rawModelName` when the model is not in our list yet.
 */
export type CardCover = CardCover1 & CardCover2;
export type CardCover1 =
  | {
      modelId: unknown;
    }
  | {
      rawModelName: unknown;
    };
export type RiskDomain = 'bio_chem' | 'cyber' | 'ai_rnd_autonomy' | 'misalignment' | 'manipulation' | 'other';
/**
 * A published safety framework. `anthropic-rsp`: Responsible Scaling Policy (also ASL levels). `anthropic-fcf`: Frontier Compliance Framework. `openai-preparedness`: Preparedness Framework. `google-fsf`: Frontier Safety Framework. `meta-aasf`: Advanced AI Scaling Framework. `amazon-fmsf`: Frontier Model Safety Framework. `xai-faif`: Frontier Artificial Intelligence Framework. `xai-rmf`: Risk Management Framework. `seoul-commitments`: Frontier AI Safety Commitments (Seoul, 2024).
 */
export type FrameworkId =
  | 'anthropic-rsp'
  | 'anthropic-fcf'
  | 'openai-preparedness'
  | 'google-fsf'
  | 'meta-aasf'
  | 'amazon-fmsf'
  | 'xai-faif'
  | 'xai-rmf'
  | 'seoul-commitments';
/**
 * Our coarse level, for sorting only. Always show the lab's own label next to it. `below`: under the lab's first threshold. `early_warning`: an alert or watch level. `reached`: a threshold is reached or cannot be ruled out. `highest`: the top level.
 */
export type RiskLevel = 'below' | 'early_warning' | 'reached' | 'highest';
export type MitigationPhase = 'before_mitigation' | 'after_mitigation' | 'unspecified';
/**
 * Our reading for a safety reader. `good`: good for safety. `mixed`: mixed, a mild concern or an important caveat. `bad`: a clear concern. `neutral`: a fact or method note.
 */
export type FindingTone = 'good' | 'mixed' | 'bad' | 'neutral';
/**
 * An RFC 3339 time with a time zone.
 */
export type Timestamp = string;
/**
 * One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
 */
export type EvalResult = (
  | {
      modelId: unknown;
    }
  | {
      rawModelName: unknown;
    }
) &
  EvalResult1;
/**
 * `reported`: from a document (give `source`). `measured`: from an `EvalRun`.
 */
export type ResultOrigin = 'reported' | 'measured';
/**
 * `run`: our runner ran it. `import`: a log made elsewhere, imported. `rescore`: our runner scored the outputs of `sourceRunId` again, with other scoring models.
 */
export type RunOrigin = 'run' | 'import' | 'rescore';
/**
 * `requested`: a user asked for it; it waits for an admin to approve it. `queued`: waits for a runner. `running`: a runner has it. `importing`: the log is being saved. `succeeded`, `failed`, `cancelled`: done.
 */
export type RunStatus = 'requested' | 'queued' | 'running' | 'importing' | 'succeeded' | 'failed' | 'cancelled';
/**
 * How the target model was served. `direct`: the lab's own API. `openrouter`, `bedrock`, `vertex`, `azure`: that router or cloud. `engine`: our interp-engine server.
 */
export type RouteKind = 'direct' | 'openrouter' | 'bedrock' | 'vertex' | 'azure' | 'engine';
/**
 * `private`: the owner only. `unlisted`: anyone with the link; never listed or indexed. `public`: listed and indexed. A record is never more visible than its parent.
 */
export type Visibility = 'private' | 'unlisted' | 'public';
export type AttemptStatus = 'success' | 'error';
export type ContentPart = TextPart | ReasoningPart | OtherPart;
/**
 * `raw`: the model's own thinking (open models). `summary`: the provider's summary. `omitted`: the provider gave none. `redacted`: the provider hid it.
 */
export type ReasoningKind = 'raw' | 'summary' | 'omitted' | 'redacted';
/**
 * A specified systemic risk of the EU General-Purpose AI Code of Practice, Safety and Security chapter, Appendix 1.4. `cbrn`: chemical, biological, radiological and nuclear. `cyber_offence`: large-scale cyber-attacks. `loss_of_control`: people can no longer direct, change or shut down the model. `harmful_manipulation`: strategic distortion of beliefs or behavior of many people or of high-stakes decision-makers.
 */
export type SystemicRisk = 'cbrn' | 'cyber_offence' | 'loss_of_control' | 'harmful_manipulation';
/**
 * Our level for one risk, from our eval runs only. It is not the Code's risk tier and not a legal finding. `not_enough_evidence`: no eval run, or too few samples, covers the risk. `no_evidence`: the runs that cover the risk show no sign of it. `low`, `moderate`, `high`: the runs show signs of the risk, from small to strong.
 */
export type VerdictLevel = 'not_enough_evidence' | 'no_evidence' | 'low' | 'moderate' | 'high';
/**
 * How well our runs cover a topic or a risk. `none`, `weak` (few samples or one narrow eval), `some`, `good`.
 */
export type CoverageLevel = 'none' | 'weak' | 'some' | 'good';
/**
 * The topic (an eval `Topic`) of the AI's act, or `other`. Topics about the test, not an act in one transcript, are not in the list.
 */
export type SnippetCategory =
  | 'harmful_requests'
  | 'agentic_misuse'
  | 'bio_chem'
  | 'cyber'
  | 'child_safety'
  | 'self_harm'
  | 'toxicity'
  | 'prompt_injection'
  | 'honesty'
  | 'manipulation'
  | 'sycophancy'
  | 'hallucination'
  | 'bias'
  | 'sabotage'
  | 'power_seeking'
  | 'reward_hacking'
  | 'other';
/**
 * `critical`: only from older flaggers. `high`: the AI seems willing to let people be killed or badly hurt, by real help or by a deliberate act as an agent. `medium`: other harmful help or acts, or a lie, hallucination or bias on something that matters. `low`: a small problem.
 */
export type SnippetSeverity = 'low' | 'medium' | 'high' | 'critical';
/**
 * How exact the date next to it is. It agrees with the date's form (YYYY-MM-DD, YYYY-MM, YYYY).
 */
export type DatePrecision = 'day' | 'month' | 'year';
/**
 * `red`: someone died, or many people were severely harmed, in credible reports or lawsuits. `orange`: a regulator or court action, a serious security breach, or credible reports of a significant safety failure or a broken safety commitment, with no death or severe harm to many people. `yellow`: concerning, but limited or disputed.
 */
export type IncidentSeverity = 'red' | 'orange' | 'yellow';
export type IncidentStatus = 'ongoing' | 'resolved' | 'disputed' | 'under_investigation' | 'in_litigation';
export type IncidentCategory =
  | 'security'
  | 'privacy'
  | 'misuse'
  | 'model_behavior'
  | 'deception'
  | 'safety_process'
  | 'governance'
  | 'legal'
  | 'child_safety'
  | 'mental_health'
  | 'misinformation'
  | 'bias'
  | 'copyright'
  | 'labor'
  | 'other';
/**
 * Who wrote a log step. `reasoning`: the model's thinking (chain of thought). `tool_call`: a command or tool call by the model. `tool_result`: what a tool or the environment returned. `note`: our short note between steps; it is not from the log.
 */
export type IncidentLogRole = 'system' | 'user' | 'assistant' | 'reasoning' | 'tool_call' | 'tool_result' | 'note';
export type DepartureKind = 'resigned' | 'fired' | 'laid_off' | 'unclear';
/**
 * Markdown text. Raw HTML is not shown.
 */
export type Markdown = string;
/**
 * `oversight`: outside people test or check the organization. `transparency`: the organization tells the public or governments what it finds. `limits`: the organization limits or stops its own development. `security`: it protects its models, or gives resources to safety.
 */
export type CommitmentCategory = 'oversight' | 'transparency' | 'limits' | 'security';
/**
 * How far the organization has committed. `full`: it meets all criteria, each independently verified. `partial`: it meets some criteria, has large exceptions, or is not all verified. `intent`: it says it will, with no terms or date. `none_found`: we checked and found no public commitment. `declined`: it publicly refused. `dropped`: it had the commitment, then withdrew it or let it end. `broken`: credible sources report that it did not keep the commitment.
 */
export type CommitmentLevel = 'full' | 'partial' | 'intent' | 'none_found' | 'declined' | 'dropped' | 'broken';
/**
 * How enforceable the commitment is. `statement`: a post or a talk; it can change at any time. `policy`: in a published policy or framework with a change process. `agreement`: signed with other parties (an accord, a contract, a government agreement). `law`: a law or regulation requires it.
 */
export type CommitmentStrength = 'statement' | 'policy' | 'agreement' | 'law';
/**
 * `ongoing`: no end date. `time_limited`: a pilot, or a term with an end date.
 */
export type CommitmentDuration = 'ongoing' | 'time_limited';
export type CriterionStatus = 'met' | 'partly' | 'not_met';
/**
 * `announced`: the first commitment. `expanded` or `narrowed`: the terms changed. `renewed`: a time-limited commitment continued. `expired`: it ended at its end date. `withdrawn`: the organization dropped it. `broken`: sources report that it was not kept. `kept`: evidence that the organization did what it said (a published report). `declined`: the organization refused.
 */
export type CommitmentEventKind =
  'announced' | 'expanded' | 'narrowed' | 'renewed' | 'expired' | 'withdrawn' | 'broken' | 'kept' | 'declined';
/**
 * What the method reads. `white_box`: activations, weights or token log probs (it needs model access). `black_box`: only text. Topics, not groups, tell the job of a method.
 */
export type MethodGroup = 'white_box' | 'black_box';
export type MethodParamType = 'integer' | 'number' | 'string' | 'boolean';
/**
 * What a variant needs from the subject model. `white_box`: activations or weights. `logprobs`: token log probabilities only. `black_box`: text in and out only.
 */
export type MethodAccess = 'white_box' | 'logprobs' | 'black_box';
/**
 * What a view says about its method, on balance.
 */
export type ExpertStance = 'positive' | 'negative' | 'mixed';
export type MethodSiteRole = 'read' | 'write';
/**
 * A SHA-256 digest, lowercase hex.
 */
export type Sha256 = string;

/**
 * A lab or company that makes models or publishes documents.
 */
export interface Organization {
  id: Id;
  /**
   * The organization's page URL (`/qwen`, `/google`): the model owner that most of its models use, in lowercase. Unique. Also a reserved handle.
   */
  slug: Slug;
  /**
   * The name to show (`Alibaba`).
   */
  displayName: string;
  /**
   * Other names in documents (`Google DeepMind` and `Google Research` for `google`).
   */
  aliases: Aliases;
  /**
   * Other slugs that redirect to `slug`: old slugs and other model owners (`alibaba` for `qwen`). Unique across all organizations.
   */
  slugAliases: Slug[];
  /**
   * The organization's own website.
   */
  website?: Url;
  /**
   * 1 to 3 sentences about the organization, with inline source links.
   */
  summary?: Markdown;
  /**
   * The day of the newest research for the organization page (YYYY-MM-DD). New research looks only for events after this day.
   */
  researchedAt?: string;
  /**
   * How wide the research was. `deep`: many searches and primary sources. `light`: a few searches; empty lists are usual.
   */
  researchDepth?: 'deep' | 'light';
}
/**
 * One model. Its facts are here, each with a source; a document is one source.
 */
export interface Model {
  id: Id;
  source: ModelSource;
  /**
   * The HF repo id or `local/<name>` for `hf`; `provider/model` for `api`. Unique with `source`. Also the URL path.
   */
  name: string;
  displayName: string;
  /**
   * The `Organization` that made the model.
   */
  organizationId: Id;
  /**
   * The model family, for grouping (`Llama 3`).
   */
  family?: string;
  /**
   * The HF commit or the API snapshot id that the facts refer to.
   */
  revision?: string;
  /**
   * Other names, such as API ids (`davinci`) and old names.
   */
  aliases: Aliases;
  /**
   * The model this one comes from. One parent; a chain for combinations.
   */
  parentId?: Id;
  parentRelation?: ParentRelation;
  /**
   * The Hub repo was removed or made private. We keep the record.
   */
  removedFromHub?: boolean;
  /**
   * A base model: pretrained only, with no instruct or chat tuning. Lists do not show it.
   */
  pretrained?: boolean;
  facts: ModelFacts;
  /**
   * The `Document`s about this model. The order has no meaning.
   */
  documentIds: Id[];
}
/**
 * Facts about a model. A fact is left out when nobody has found it yet.
 */
export interface ModelFacts {
  releaseDate?: DateFact;
  knowledgeCutoff?: DateFact;
  /**
   * Tokens.
   */
  contextWindow?: CountFact;
  /**
   * Tokens.
   */
  maxOutput?: CountFact;
  modalities?: ModalitiesFact;
  /**
   * The reasoning settings the model has (`none`, `low`, `high`).
   */
  reasoningModes?: TagsFact;
  /**
   * BCP 47 language tags (`en`, `zh`).
   */
  languages?: TagsFact;
  /**
   * An SPDX id when there is one (`apache-2.0`), else the license name.
   */
  license?: TextFact;
  totalParams?: CountFact;
  /**
   * Parameters used per token. Less than `totalParams` for a mixture of experts.
   */
  activeParams?: CountFact;
  /**
   * A short description (`MoE transformer, 256 experts`).
   */
  architecture?: TextFact;
}
export interface DateFact {
  value: PartialDate;
  source: FactSource;
}
/**
 * Where a fact comes from.
 */
export interface FactSource {
  /**
   * `document`: a `Document` (give `documentId`, and `page` and `quote` when you can). `hf_config`: the model's Hub config. `provider_docs` and `url`: a web page (give `url`). `manual`: entered by a person without a source to cite.
   */
  kind: FactSourceKind;
  documentId?: Id;
  url?: Url;
  /**
   * The page or section (`12`, `A.3`).
   */
  page?: string;
  quote?: string;
}
export interface ModalitiesFact {
  value: Modalities;
  source: FactSource;
}
export interface Modalities {
  input: Modality[];
  output: Modality[];
}
export interface CountFact {
  value: number;
  source: FactSource;
}
/**
 * A document an organization published about models: a link, our saved copy of the file and facts we took from it. `url` stays the publisher's link.
 */
export interface Document {
  id: Id;
  /**
   * A readable unique key (`openai-gpt2-blog`).
   */
  key: DocumentKey;
  kind: DocumentKind;
  title: string;
  url: Url;
  /**
   * The `Organization` that published it.
   */
  publisherId: Id;
  publishedDate?: PartialDate;
  /**
   * Where we got the saved copy, when it is not `url` (the PDF that a web page links to).
   */
  fileUrl?: Url;
  /**
   * The saved copy in our storage (`documents/<key>.pdf`).
   */
  fileKey?: string;
  fileType?: 'pdf' | 'html';
  /**
   * The hash of the saved copy.
   */
  sha256?: Sha256;
  /**
   * When we fetched the saved copy.
   */
  fetchedAt?: Timestamp;
  /**
   * A person checked that the link works and that the publisher is correct.
   */
  verified: boolean;
  /**
   * Notes for reviewers. Not shown on public pages.
   */
  notes?: string;
}
/**
 * A test of models, auditors or interp methods: a benchmark, a red team, an automated audit. Results point to one of its `EvalVersion`s.
 */
export interface Eval {
  id: Id;
  /**
   * The name in URLs (`petri`, `mask`). Unique on the site.
   */
  slug: Slug;
  displayName: string;
  /**
   * Other spellings in documents (`Model Alignment between Statements and Knowledge`).
   */
  aliases: Aliases;
  /**
   * A short Markdown description.
   */
  description?: string;
  /**
   * One plain sentence about what the eval tests, for lists and tables ("Tests whether the model lies under pressure about what it believes is true.").
   */
  summary?: string;
  /**
   * Groups related evals (`Petri` for Petri and Petri Bloom suites).
   */
  family?: string;
  /**
   * The `EvalSuite` that the eval is part of.
   */
  suiteId?: Id;
  maintainers: EvalMaintainer[];
  links: EvalLink[];
  access: EvalAccess;
  status: EvalStatus;
  /**
   * One line on why we marked it `saturated` (`Current models refuse almost every prompt.`). Markdown.
   */
  saturatedReason?: string;
  /**
   * The day we marked it `saturated` (YYYY-MM-DD).
   */
  saturatedDecisionDate?: string;
  /**
   * One line on why we marked it `legacy` (`Built for base-model continuation; chat models score near zero.`). Markdown.
   */
  legacyReason?: string;
  /**
   * The day we marked it `legacy` (YYYY-MM-DD).
   */
  legacyDecisionDate?: string;
  /**
   * The slug of the newer eval to use in place of this one.
   */
  supersededBy?: Slug;
  /**
   * A full run costs little, so a user's request of it starts without an admin's approval (when its estimated cost is under the limit).
   */
  autoApprove?: boolean;
  facets: EvalFacets;
  /**
   * Cheaper judge or helper models that we tested against the defaults.
   */
  recommendedModels?: RecommendedModel[];
  /**
   * The eval's canary string. We show it on each page, so training filters can drop them.
   */
  canary?: string;
  /**
   * The user who made it. Left out for evals in the site registry (seed data).
   */
  ownerUserId?: Id;
  /**
   * A private eval needs an owner. Anyone with the link can open an unlisted eval.
   */
  visibility: Visibility;
}
/**
 * Who maintains the eval. Give `organizationId` when the maintainer is an `Organization`.
 */
export interface EvalMaintainer {
  name: string;
  organizationId?: Id;
  url?: Url;
}
export interface EvalLink {
  kind: EvalLinkKind;
  url: Url;
  title?: string;
}
/**
 * Independent answers to one question each. Labels such as "benchmark" or "red team" are combinations of these.
 */
export interface EvalFacets {
  /**
   * @minItems 1
   */
  measures: [Measures, ...Measures[]];
  /**
   * @minItems 1
   */
  formats: [EvalFormat, ...EvalFormat[]];
  /**
   * @minItems 1
   */
  cases: [EvalCases, ...EvalCases[]];
  /**
   * @minItems 1
   */
  grading: [Grading, ...Grading[]];
  /**
   * The eval tries to make the subject fail (red teaming, jailbreaks).
   */
  adversarial: boolean;
  /**
   * People take part, as in uplift trials.
   */
  humanParticipants: boolean;
  /**
   * @minItems 1
   */
  subjects: [SubjectKind, ...SubjectKind[]];
  topics: Topic[];
}
/**
 * A model we recommend for one role in an eval, in place of its default. We tested it on some samples and its results agreed with the default model's results.
 */
export interface RecommendedModel {
  /**
   * The role, as the eval's task names it (`judge`, `auditor`, `grader`).
   */
  role: string;
  /**
   * The model, as OpenRouter names it (`google/gemini-2.5-flash-lite`).
   */
  model: string;
  /**
   * The day we made the recommendation (YYYY-MM-DD).
   */
  recommendedAt: PartialDate;
  /**
   * The default model for the role (`openai/gpt-4-turbo`).
   */
  replaces?: string;
  /**
   * The eval version that we tested.
   */
  version?: string;
  /**
   * Markdown. What we tested (samples, agreement, cost) and the run ids.
   */
  evidence: string;
}
/**
 * A set of evals that one source publishes together (SAEBench). Its page compares method variants across its evals. An eval names its suite with `suiteId`.
 */
export interface EvalSuite {
  id: Id;
  /**
   * The name in URLs (`saebench`).
   */
  slug: Slug;
  displayName: string;
  /**
   * One plain sentence about what the suite tests.
   */
  summary: string;
  /**
   * A short Markdown description.
   */
  description?: string;
  maintainers: EvalMaintainer[];
  links: EvalLink[];
  /**
   * Slugs of its evals in display order, safety tasks first. Its other evals follow, safety tasks first, then by name.
   */
  evalOrder?: Slug[];
  /**
   * Compare method variants at set values of one metric of a suite eval. Without it, each variant uses its one artifact in a group.
   */
  matched?: MethodMatch;
}
/**
 * One fixed form of an eval: its samples and how they are scored. Results from different versions are not comparable. A new version when the samples, scores, rubric or task defaults change. Judge and auditor models are run settings. A package release that changes none of these only changes the `runner` pins; each run keeps its package versions.
 */
export interface EvalVersion {
  id: Id;
  evalId: Id;
  /**
   * The maintainer's name for it (`2.0`, `2026-02`). Unique per eval.
   */
  version: string;
  status: EvalVersionStatus;
  releasedDate?: PartialDate;
  /**
   * What changed from the version before, in Markdown.
   */
  changes?: string;
  /**
   * Left out for `lab_internal` evals.
   */
  dataset?: EvalDataset;
  sampleTerms?: SampleTerms;
  scores: ScoreDef[];
  metrics: MetricDef[];
  runner?: EvalRunner;
  /**
   * Only for evals whose subjects are methods.
   */
  methodSetup?: MethodEvalSetup;
}
/**
 * The source's terms on showing its samples, and our rule for them. Left out: `open`.
 */
export interface SampleTerms {
  display: DisplayRule;
  /**
   * The terms, as the source states them. Left out when the source states none.
   */
  quote?: string;
  /**
   * Where the terms are (the gate page or the README).
   */
  source: Url;
  /**
   * Why this rule, when the quote alone does not say.
   */
  note?: string;
  /**
   * Rules for some samples. A matching rule replaces `display` for those samples.
   */
  subsets?: SubsetTerms[];
}
/**
 * A rule for the samples whose metadata `key` equals `value` (a dataset inside a suite).
 */
export interface SubsetTerms {
  /**
   * The sample metadata key, as the Inspect task sets it (`dataset_name`).
   */
  key: string;
  value: string;
  display: DisplayRule;
  /**
   * The terms, as the source states them.
   */
  quote?: string;
  source: Url;
}
/**
 * One score a scorer gives each attempt (Petri's judge gives about 36).
 */
export interface ScoreDef {
  /**
   * The name in data (`unprompted_deception`).
   */
  key: string;
  /**
   * The name of this score on an attempt when it is not `key` or ends with `/<key>`, such as the scorer's name (`fortress_scorer_adversarial`).
   */
  attemptName?: string;
  /**
   * The factor that puts an attempt's value on this score's scale (100 for a 0 to 1 value of a percent).
   */
  attemptScale?: number;
  displayName: string;
  type: ScoreType;
  min?: number;
  max?: number;
  direction: Direction;
  /**
   * What the score means; for a judge, a summary of its rubric.
   */
  description?: string;
  pass?: PassRule;
}
/**
 * When one attempt's value of this score is a pass or a fail, if the direction cannot tell. The runner marks each attempt by the rule of its headline score, and the attempt page marks each score. With no rule, the direction decides: see `ADD_AN_EVAL.md`. A value that the rule does not name has no mark.
 */
export interface PassRule {
  /**
   * Each value as text and its mark: true for a pass (MASK: `honest` true, `lie` false). Case and spaces at the ends do not count. A number is its shortest text (`1`, `0.5`).
   */
  values?: {
    [k: string]: boolean | undefined;
  };
  /**
   * For each sample target, the values and their marks, as in `values` (AbstentionBench: with the target `True`, `yes` is a pass).
   */
  byTarget?: {
    [k: string]:
      | {
          [k: string]: boolean | undefined;
        }
      | undefined;
  };
  /**
   * A number at this value or above is a fail, and a lower number is a pass (Petri's 1 to 10 scale, 7).
   */
  failAtOrAbove?: number;
  /**
   * The group metric keys that the rule is for. An attempt in none of them has no mark (APE: only the harmful topics).
   *
   * @minItems 1
   */
  groups?: [string, ...string[]];
  /**
   * No mark on any value, for a score that is not good or bad for safety by itself.
   */
  none?: true;
}
/**
 * One aggregate number an `EvalResult` can hold.
 */
export interface MetricDef {
  key: string;
  displayName: string;
  /**
   * The `ScoreDef.key` it comes from. Left out for `custom`.
   */
  score?: string;
  aggregation: MetricAggregation;
  /**
   * For `pass_at_k`.
   */
  k?: number;
  /**
   * Left out for a plain number or a fraction (`percent`, `tokens`).
   */
  unit?: string;
  min?: number;
  max?: number;
  /**
   * Which way is better for the eval's own goal. For a skill eval, more skill.
   */
  direction: Direction;
  /**
   * Which way is better for safety, as in `EvalResult.safetyDirection`; measured results get it. `neither` for skill metrics (dangerous skills too) and for refusals of safe requests.
   */
  safetyDirection?: Direction;
  /**
   * The number to show first. At most one per version.
   */
  headline?: boolean;
  description?: string;
}
/**
 * How to run a version. Optional; a run can come from anywhere.
 */
export interface EvalRunner {
  kind: RunnerKind;
  /**
   * The task to run (`inspect_evals/mask`, `inspect_petri/audit`).
   */
  task?: string;
  /**
   * The package and version that has the task (`inspect-evals==0.9.2`).
   */
  package?: string;
  /**
   * Other packages the task uses, each with its version (`inspect-petri==3.1.0`).
   */
  dependencies?: string[];
  /**
   * The model roles a run must fill.
   */
  roles?: ModelRole[];
  /**
   * The models besides the target, and how the task gets each one.
   */
  models?: ModelSlot[];
  /**
   * Also give the target as this Inspect model role (`target`), for tasks that read it by role.
   */
  targetRole?: string;
  /**
   * The sandbox the task needs (`docker`), if any.
   */
  sandbox?: string;
  internet?: boolean;
  /**
   * The runner needs a GPU (white-box methods).
   */
  gpu?: boolean;
  /**
   * The scores need the model's raw chain of thought. Most provider APIs do not return it, so we do not offer the eval for API models.
   */
  rawReasoning?: boolean;
  defaultTrials?: number;
  /**
   * The samples a run does when its settings give no limit. A run with this limit or more counts as a full run.
   */
  defaultLimit?: number;
}
/**
 * One model a task needs besides the target. The runner gives it as `taskArg` or as `inspectRole`; give one. A run can change it; a re-score can change it only when `scoring`.
 */
export interface ModelSlot {
  /**
   * Unique in the version (`judge`, `refusal_judge`, `mark`).
   */
  id: string;
  role: ModelRole;
  /**
   * The name to show (`Refusal judge`). Default from `id`.
   */
  label?: string;
  /**
   * Give the model as this task argument (`scorer_model`).
   */
  taskArg?: string;
  /**
   * The place in a list task argument (`grader_models`).
   */
  index?: number;
  /**
   * Give the model as this Inspect model role (`grader`).
   */
  inspectRole?: string;
  /**
   * The model the task uses when not told, as a route model id (`openai/gpt-4o`). With a `tier`, our runs use the tier and this is only a record of the task's default.
   */
  default: string;
  /**
   * The lowest tier in spec/model-ladders.yaml that is good enough for this slot. A run gets the first model of the tier that the rules allow, and the next ones as fallbacks. A model of a higher tier is also good enough.
   */
  tier?: string;
  /**
   * Use these labs' models of the tier first, in this order, when the rules allow it.
   *
   * @minItems 1
   */
  labs?: [LabPrefix, ...LabPrefix[]];
  /**
   * The slot can use a model of the target's lab (one judge in a panel of judges from several labs). It never uses the target model itself.
   */
  sameLab?: boolean;
  /**
   * Only the scorer uses it, so a re-score can change it.
   */
  scoring?: boolean;
}
/**
 * One sample of an eval version, as Inspect's `Sample`. Each split keeps `sourceId` and `sha256`; only a `stored` split also keeps `input`.
 */
export interface EvalSample {
  id: Id;
  evalVersionId: Id;
  /**
   * An `EvalSplit.name` of the version.
   */
  split: string;
  /**
   * The sample's id in the source. Unique in its split.
   */
  sourceId: string;
  /**
   * A prompt, or chat messages.
   */
  input?: string | [SampleMessage, ...SampleMessage[]];
  /**
   * The answer or answers the scorer looks for.
   */
  target?: string | string[];
  /**
   * The options of a multiple-choice sample.
   */
  choices?: string[];
  /**
   * Other fields of the source sample, as they are in the source.
   */
  metadata: {};
  /**
   * The hash of `{"id": sourceId, "input": input}` as JSON with sorted keys and no spaces. Chat input is `SampleMessage[]`.
   */
  sha256: string;
}
/**
 * One chat message of a sample's input. Text only.
 */
export interface SampleMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}
/**
 * What we extracted from one card. One card can have several documents (the PDF, the web page, the blog post); `documentId` is the one we read.
 */
export interface SystemCard {
  id: Id;
  documentId: Id;
  /**
   * Other documents of the same card.
   */
  alsoDocumentIds: Id[];
  covers: CardCover[];
  /**
   * The card this one updates (a delta card).
   */
  basedOnDocumentId?: Id;
  pageCount?: number;
  disclosures: Disclosures;
  riskDecisions: RiskDecision[];
  topics: TopicCoverage[];
  testers: ExternalTester[];
  findings: Finding[];
  /**
   * A person checked it. Pages mark unreviewed values "Not reviewed".
   */
  reviewed: boolean;
  extraction: ExtractionInfo;
}
export interface CardCover2 {
  modelId?: Id;
  rawModelName?: string;
  /**
   * The section about it, for cards that cover several models (`Appendix B`).
   */
  section?: string;
}
/**
 * The disclosure checklist. The keys match `ModelFacts`, plus training facts.
 */
export interface Disclosures {
  releaseDate?: Disclosure;
  knowledgeCutoff?: Disclosure;
  contextWindow?: Disclosure;
  maxOutput?: Disclosure;
  modalities?: Disclosure;
  reasoningModes?: Disclosure;
  languages?: Disclosure;
  license?: Disclosure;
  totalParams?: Disclosure;
  activeParams?: Disclosure;
  architecture?: Disclosure;
  trainingData?: Disclosure;
  trainingCompute?: Disclosure;
}
/**
 * One model fact. `stated`: the card says it (give `value` and `source`). `not_stated`: we read the card; it does not say. Left out: not extracted yet.
 */
export interface Disclosure {
  status: 'stated' | 'not_stated';
  /**
   * The value in the card's words (`200K tokens`, `March 2026`).
   */
  value?: string;
  source?: CardSource;
}
/**
 * Where in the document a value is. The quote is the card's own words.
 */
export interface CardSource {
  /**
   * The page or section (`12`, `5.3.2`), as printed in the document.
   */
  page?: string;
  /**
   * The page in our saved PDF, from 1. Links go here; `page` is what we show.
   */
  pdfPage?: number;
  quote: string;
}
/**
 * One risk decision the lab states for one domain.
 */
export interface RiskDecision {
  domain: RiskDomain;
  /**
   * The published frameworks the verdict is made under. Leave out if none is named.
   *
   * @minItems 1
   */
  frameworks?: [FrameworkId, ...FrameworkId[]];
  /**
   * The lab's words (`ASL-3`, `High`, `CCL not reached`).
   */
  labLabel: string;
  level?: RiskLevel;
  phase: MitigationPhase;
  /**
   * Who decided, when the card says (`Responsible Scaling Officer`).
   */
  decidedBy?: string;
  /**
   * The covered models the verdict is about. Left out when it is about all of them.
   *
   * @minItems 1
   */
  modelIds?: [Id, ...Id[]];
  source: CardSource;
}
/**
 * Does the card cover a topic. `covered`: give a source, and a headline number when there is one. Not covered: the card has nothing on it. Left out: not extracted yet.
 */
export interface TopicCoverage {
  topic: Topic;
  covered: boolean;
  /**
   * The main result in the card's words (`0.8% jailbreak success`).
   */
  headline?: string;
  source?: CardSource;
}
export interface ExternalTester {
  /**
   * The tester (`METR`, `UK AISI`, `Apollo Research`).
   */
  name: string;
  /**
   * What they tested (`autonomy and AI R&D`).
   */
  scope?: string;
  source: CardSource;
}
/**
 * A notable finding that fits nowhere else. Short, in our words, with the quote.
 */
export interface Finding {
  text: string;
  tone?: FindingTone;
  source: CardSource;
}
/**
 * How a record was made. `by` is the model or person.
 */
export interface ExtractionInfo {
  by: string;
  at: Timestamp;
}
export interface EvalResult1 {
  id: Id;
  origin: ResultOrigin;
  evalId?: Id;
  evalVersionId?: Id;
  /**
   * The eval's name as the source writes it (`SWE-bench Verified (n=500)`).
   */
  rawEvalName?: string;
  modelId?: Id;
  /**
   * The model's name as the source writes it.
   */
  rawModelName?: string;
  /**
   * A `MetricDef.key` when the version is known; else the source's words.
   */
  metric: string;
  value: number;
  /**
   * `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
   */
  unit?: 'fraction' | 'percent' | 'score' | 'count' | 'seconds' | 'tokens' | 'other';
  stderr?: number;
  ciLow?: number;
  ciHigh?: number;
  /**
   * The number of samples, when stated.
   */
  n?: number;
  /**
   * Which way is better for safety. `neither` for skill results (dangerous skills too) and for refusals of safe requests. Left out: not known.
   */
  safetyDirection?: Direction;
  /**
   * Which way shows more skill. `neither` for behavior results. Left out: not known.
   */
  capabilityDirection?: Direction;
  settings: ResultSettings;
  source?: ResultSource;
  /**
   * The run a `measured` result comes from.
   */
  evalRunId?: Id;
  reviewed: boolean;
  extraction?: ExtractionInfo;
}
/**
 * How the number was made. Compare results only when these match. Left out: not stated.
 */
export interface ResultSettings {
  /**
   * The lab's words (`high`, `max`, `no thinking`).
   */
  reasoningEffort?: string;
  tools?: boolean;
  passAtK?: number;
  trials?: number;
  /**
   * The scaffold or agent (`Claude Code`, `Terminus 2`).
   */
  harness?: string;
  /**
   * Production safeguards (classifiers) were on.
   */
  safeguards?: boolean;
  /**
   * A helpful-only model, without safety training.
   */
  helpfulOnly?: boolean;
  /**
   * Where it ran (`API`, `ChatGPT`).
   */
  surface?: string;
  /**
   * The judge and other models besides the target, as `slot: model` pairs (`judge: openai/gpt-4o`). Scores with different judges are not comparable.
   */
  otherModels?: string;
  /**
   * Anything else the source says about the setup.
   */
  other?: string;
}
export interface ResultSource {
  documentId: Id;
  /**
   * The page or section, as printed in the document.
   */
  page?: string;
  /**
   * The page in the document's saved PDF, from 1. Links go here.
   */
  pdfPage?: number;
  /**
   * The table or figure (`Table 4`, `Figure 2.3.A`).
   */
  table?: string;
  quote?: string;
}
/**
 * One run of an eval version on one model, with its settings and provenance. `measured` results and attempts point to it.
 */
export interface EvalRun {
  id: Id;
  evalId: Id;
  evalVersionId: Id;
  modelId: Id;
  origin: RunOrigin;
  /**
   * For a re-score, the run whose outputs it scores.
   */
  sourceRunId?: Id;
  status: RunStatus;
  route: ServingRoute;
  settings: RunSettings;
  provenance?: RunProvenance;
  /**
   * The original log (an Inspect `.eval`).
   */
  log?: FileRef;
  /**
   * The samples the run plans to do.
   */
  sampleCount?: number;
  /**
   * The attempts done so far.
   */
  attemptCount?: number;
  error?: string;
  visibility: Visibility;
  createdAt: Timestamp;
}
/**
 * How a run reached the model. Provenance and a filter; not a change to the model.
 */
export interface ServingRoute {
  kind: RouteKind;
  /**
   * The model id on the route (`qwen/qwen3.6-27b`).
   */
  model: string;
  /**
   * The providers the router may use, in order (OpenRouter `provider.order`).
   */
  providers?: string[];
  allowFallbacks?: boolean;
  /**
   * For a slot: other models to try, in order, when this model fails a call or refuses it (an error, a content filter or an empty reply).
   */
  fallbacks?: string[];
  /**
   * The weights' precision as the route states it (`bf16`, `fp8`, `unknown`).
   */
  quantization?: string;
}
/**
 * What the runner was asked to do. Left out: the task's default.
 */
export interface RunSettings {
  /**
   * Thinking effort, in OpenRouter's words. `none`: no thinking. `on`: thinking at the model's default, for models with no effort levels.
   */
  reasoning?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'on';
  /**
   * Run only the first samples of the dataset.
   */
  limit?: number;
  epochs?: number;
  /**
   * Parallel model calls in each shard.
   */
  maxConnections?: number;
  /**
   * Samples in each shard. Left out, the runner's default.
   */
  shardSize?: number;
  /**
   * The `runner_cap` key for the run's shards, for one cap per model server. Left out: from the route.
   */
  capKey?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Arguments for the task (`{"target": "mc1"}`).
   */
  taskArgs?: {};
  /**
   * The model for each slot in the version's `runner.models`, by slot id.
   */
  models?: {
    [k: string]: ServingRoute | undefined;
  };
}
/**
 * Where and how the run happened.
 */
export interface RunProvenance {
  /**
   * The program that ran the eval (`inspect_ai`).
   */
  tool?: string;
  toolVersion?: string;
  /**
   * Package versions, as the log states them (`{"inspect_evals": "0.22.0"}`).
   */
  packages?: {
    [k: string]: string | undefined;
  };
  /**
   * The task as the log names it (`inspect_evals/truthfulqa`).
   */
  task?: string;
  taskArgs?: {};
  /**
   * The model as the log names it (`openrouter/qwen/qwen3.6-27b`).
   */
  logModel?: string;
  /**
   * The providers that served the model calls, as the route reported them.
   */
  servedBy?: string[];
  /**
   * The machine the runner ran on.
   */
  host?: string;
  runnerVersion?: string;
  startedAt?: Timestamp;
  finishedAt?: Timestamp;
  tokens?: TokenUsage;
  /**
   * What this run paid, when the routes say. A re-score pays only its judges.
   */
  costUsd?: number;
  /**
   * What a reader must know about an imported run, from the log (`eval.metadata.note`). The run and attempt pages show it.
   */
  note?: string;
  /**
   * Tokens and cost for each model, by the name in the log.
   */
  byModel?: {
    [k: string]: ModelUsage | undefined;
  };
  /**
   * Tokens and cost for each model role (`target`, `auditor`, `judge`, `judge_2`). A re-score has only its judges.
   */
  byRole?: {
    [k: string]: ModelUsage | undefined;
  };
  /**
   * Samples with an error and no score. The results leave them out.
   */
  erroredSamples?: number;
  /**
   * The calls that a slot's fallback models made in place of its model.
   */
  fallbacks?: FallbackUse[];
  /**
   * Model calls that a provider refused for its policy, by provider. A run that failed or was cancelled because of a block also has them.
   */
  blocks?: ProviderBlock[];
}
export interface TokenUsage {
  input?: number;
  output?: number;
  /**
   * Part of `output`.
   */
  reasoning?: number;
  /**
   * Input tokens read from the provider's prompt cache. Part of `input`.
   */
  cacheRead?: number;
  /**
   * Input tokens written to the provider's prompt cache. Part of `input`.
   */
  cacheWrite?: number;
}
export interface ModelUsage {
  tokens?: TokenUsage;
  costUsd?: number;
  /**
   * The route did not state the cost; `costUsd` is list price times tokens.
   */
  costEstimated?: boolean;
  servedBy?: string[];
}
export interface FallbackUse {
  slot: string;
  model: string;
  calls: number;
}
/**
 * Samples whose model calls a provider refused for its policy (not the model's own refusal). These samples have no score.
 */
export interface ProviderBlock {
  /**
   * The provider that refused (`Meta`, `OpenAI`), or `unknown`.
   */
  provider: string;
  /**
   * `account`: the provider blocked our account, so it refuses all calls. `content`: it refused these prompts only.
   */
  kind: 'account' | 'content';
  /**
   * The provider's error code (`user_blocked`, `data_inspection_failed`).
   */
  code?: string;
  message?: string;
  /**
   * The model of the refused calls, when the error names it.
   */
  model?: string;
  /**
   * The samples with this block. Zero when the run stopped before its samples.
   */
  samples: number;
}
/**
 * One sample in one epoch of a run: a short copy of the input and output for lists, the scores, and the full transcript in `body`.
 */
export interface EvalAttempt {
  id: Id;
  runId: Id;
  /**
   * The attempt's place in the log, from 1. URLs use it.
   */
  ordinal: number;
  /**
   * The sample's id in the log.
   */
  sampleId: string;
  /**
   * The stored `EvalSample`, when we keep the samples.
   */
  evalSampleId?: Id;
  epoch: number;
  status: AttemptStatus;
  /**
   * The headline score is correct. Left out when the score is not pass or fail.
   */
  passed?: boolean;
  /**
   * The first user message, shortened.
   */
  input?: string;
  target?: string | string[];
  choices?: string[];
  /**
   * The final answer, shortened.
   */
  output?: string;
  /**
   * By scorer name.
   */
  scores: {
    [k: string]: AttemptScore | undefined;
  };
  /**
   * The keys of the metrics over a part of the samples (a category or group) that count this attempt, such as `harm_score_copyright`.
   */
  metrics?: string[];
  error?: string;
  /**
   * Why the attempt has no scores, from the sample's `notScored` metadata.
   */
  notScored?: string;
  tokens?: TokenUsage;
  seconds?: number;
  /**
   * A subset rule that matched this sample. Left out, the version's rule applies.
   */
  display?: DisplayRule;
  /**
   * Set from the dataset's labels when the eval graded the reply unsafe. Left out, open.
   */
  hazard?: Hazard;
  /**
   * The attempt's `Transcript` as JSON.
   */
  body?: FileRef;
}
/**
 * One scorer's grade of an attempt, as Inspect's `Score`.
 */
export interface AttemptScore {
  /**
   * A number, a letter (`C` correct, `I` incorrect), or a yes/no.
   */
  value: number | string | boolean;
  /**
   * The answer the scorer read from the output.
   */
  answer?: string;
  explanation?: string;
}
/**
 * The messages of one attempt or chat. Scores stay on the attempt. `extensions` keeps source fields we do not map (`extensions.inspect`).
 */
export interface Transcript {
  id: Id;
  /**
   * @minItems 1
   */
  participants: [Participant, ...Participant[]];
  /**
   * @minItems 1
   */
  threads: [Thread, ...Thread[]];
  extensions?: {};
}
export interface Participant {
  id: string;
  role: ModelRole;
  modelId?: Id;
  /**
   * The model or person as the source names it.
   */
  name?: string;
}
/**
 * One participant's ordered view of the conversation.
 */
export interface Thread {
  id: string;
  /**
   * A `Participant.id`.
   */
  participant: string;
  messages: Message[];
}
/**
 * One chat message. A superset of Inspect's and OpenAI's shape.
 */
export interface Message {
  /**
   * Stable, so notes and links survive import and export.
   */
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: ContentPart[];
  toolCalls?: ToolCall[];
  /**
   * For a `tool` message, the call it answers.
   */
  toolCallId?: string;
  /**
   * For an `assistant` message, the model that wrote it.
   */
  model?: string;
}
export interface TextPart {
  type: 'text';
  text: string;
}
export interface ReasoningPart {
  type: 'reasoning';
  kind: ReasoningKind;
  text?: string;
  /**
   * The provider's opaque blob, kept so the transcript can continue there.
   */
  signature?: string;
}
/**
 * A part we do not show yet (an image, audio); the original log keeps it.
 */
export interface OtherPart {
  type: 'other';
  kind: string;
}
export interface ToolCall {
  id: string;
  function: string;
  arguments?: {};
}
/**
 * One version of a model's OpenAudit Card: our summary from our own eval runs only. An LLM (`aggregator`) writes it from the runs' results and the flagged snippets.
 */
export interface OpenAuditCardVersion {
  id: Id;
  modelId: Id;
  number: number;
  /**
   * The model that wrote it (`anthropic/claude-sonnet-5.5`).
   */
  aggregator: string;
  promptVersion: string;
  costUsd: number;
  createdAt: Timestamp;
  runs: CardRun[];
  snippetIds: Id[];
  findings: CardFinding[];
  verdicts: RiskVerdict[];
  topics: TopicSummary[];
  gaps: CoverageGap[];
}
/**
 * One run a version used, and its eval version.
 */
export interface CardRun {
  runId: Id;
  evalVersionId: Id;
}
/**
 * One notable finding, in Markdown. It names the runs (and snippets) it rests on.
 */
export interface CardFinding {
  text: string;
  tone: FindingTone;
  /**
   * @minItems 1
   */
  runIds: [Id, ...Id[]];
  snippetIds?: Id[];
}
/**
 * Our verdict on one systemic risk. `evidence` is the runs it rests on; `missing` says what no run covers yet.
 */
export interface RiskVerdict {
  risk: SystemicRisk;
  level: VerdictLevel;
  coverage: CoverageLevel;
  /**
   * Markdown. What the evidence shows, and how strong it is.
   */
  summary: string;
  runIds: Id[];
  /**
   * The parts of the risk that no run covers.
   */
  missing: string;
}
/**
 * What our runs show for one topic. `summary` is left out when no run covers it.
 */
export interface TopicSummary {
  topic: Topic;
  coverage: CoverageLevel;
  summary?: string;
  runIds: Id[];
}
/**
 * A topic or a risk that our runs do not cover, or cover only weakly.
 */
export interface CoverageGap {
  kind: 'topic' | 'risk';
  /**
   * A `Topic` or a `SystemicRisk`.
   */
  key: string;
  coverage: 'none' | 'weak';
  text: string;
}
/**
 * One case that the flagger model marked in one attempt of a run.
 */
export interface OpenAuditSnippet {
  id: Id;
  runId: Id;
  attemptId: Id;
  category: SnippetCategory;
  severity: SnippetSeverity;
  /**
   * The problem in 1 to 3 words, for example "Copyright violation". Older snippets have none.
   */
  title?: string;
  /**
   * One or two sentences.
   */
  reason: string;
  excerpt: SnippetExcerpt;
  flagger: string;
  promptVersion: string;
}
export interface SnippetExcerpt {
  /**
   * @minItems 1
   */
  messages: [SnippetMessage, ...SnippetMessage[]];
  /**
   * The exact words that show the problem. Left out when the flagger's quote is not in the transcript.
   */
  quote?: string;
}
export interface SnippetMessage {
  /**
   * The message's place in the target's thread, from 0.
   */
  index: number;
  role: 'system' | 'user' | 'assistant' | 'tool';
  /**
   * The message text, cut when long.
   */
  text: string;
}
/**
 * A significant AI safety, security or responsible-AI event that involves the organization or its models, with at least one safety category. Not copyright, scraping, likeness, labor, privacy-regulator, censorship, bias, sanction or corporate-governance matters. Its page is `/<organization slug>/incidents/<slug>`.
 */
export interface OrgIncident {
  id: Id;
  organizationId: Id;
  /**
   * Unique in the organization (`2023-internal-forum-breach`).
   */
  slug: Slug;
  title: string;
  /**
   * When the incident started.
   */
  date: PartialDate;
  datePrecision: DatePrecision;
  endDate?: PartialDate;
  severity: IncidentSeverity;
  status: IncidentStatus;
  /**
   * The one category that the feeds show.
   */
  primaryCategory: IncidentPrimaryCategory;
  /**
   * Tags.
   *
   * @minItems 1
   */
  categories: [IncidentCategory, ...IncidentCategory[]];
  /**
   * 1 or 2 sentences.
   */
  summary: Markdown;
  /**
   * 2 or 3 short sentences, on the incident page.
   */
  description: Markdown;
  /**
   * The models whose behavior is the incident: the model that did the unsafe act, that people misused, or whose weights leaked or safeguard failed. Any developer. Empty when no model's behavior is part of it. A model with no public name has a placeholder model (`openai/unreleased-hf-hack`, `xai/unknown-deepfakes`).
   */
  modelIds?: Id[];
  /**
   * @minItems 1
   */
  sources: [OrgSource, ...OrgSource[]];
  /**
   * Log excerpts that show the model's behavior, in source order.
   */
  logs?: IncidentLog[];
}
/**
 * A public source for a fact.
 */
export interface OrgSource {
  url: Url;
  /**
   * The headline or page title.
   */
  title?: string;
  /**
   * The outlet or site (`Reuters`).
   */
  publisher?: string;
  date?: PartialDate;
}
/**
 * One excerpt of a log (a chat, chain of thought or tool calls) from a source, with the steps copied as the source shows them.
 */
export interface IncidentLog {
  /**
   * A few words about the excerpt (`The model reads the Slack thread`).
   */
  title: string;
  /**
   * 1 or 2 short sentences about what the excerpt shows.
   */
  description: Markdown;
  source: OrgSource;
  /**
   * The model as the source names it.
   */
  model?: string;
  /**
   * The steps are read from a screenshot.
   */
  ocr?: boolean;
  /**
   * @minItems 1
   */
  steps: [IncidentLogStep, ...IncidentLogStep[]];
}
export interface IncidentLogStep {
  role: IncidentLogRole;
  /**
   * The source's label for the step (`Tool result — Slack message`).
   */
  label?: string;
  /**
   * As the source shows it. `[...]` marks text that the source cut, and `[name]` text that it replaced.
   */
  text: string;
}
/**
 * One event in an incident's timeline.
 */
export interface OrgIncidentEvent {
  id: Id;
  incidentId: Id;
  /**
   * The place in the timeline, from 0. Events with the same date keep this order.
   */
  order: number;
  date: PartialDate;
  datePrecision: DatePrecision;
  title: string;
  /**
   * One sentence.
   */
  description?: Markdown;
  sources: OrgSource[];
}
/**
 * A person who left in 2023 or later over AI safety concerns at the organization, or a safety leader who left. Not ethics, copyright or personal reasons.
 */
export interface OrgDeparture {
  id: Id;
  organizationId: Id;
  /**
   * Unique in the organization.
   */
  name: string;
  /**
   * The person's role at the organization.
   */
  title?: string;
  departedDate?: PartialDate;
  datePrecision?: DatePrecision;
  kind: DepartureKind;
  reason?: Markdown;
  /**
   * The person's own words, copied exactly from the source.
   */
  quote?: {
    text: string;
    url: Url;
  };
  /**
   * A freely licensed photo from Wikimedia Commons.
   */
  image?: {
    url: string;
    /**
     * The Commons file page.
     */
    pageUrl: string;
    license: string;
    /**
     * The author as Commons states it.
     */
    author: string;
  };
  /**
   * The person's own site.
   */
  website?: Url;
  nextRole?: Markdown;
  /**
   * @minItems 1
   */
  sources: [OrgSource, ...OrgSource[]];
}
/**
 * One kind of safety commitment, with the criteria of its ideal form. Its page is `/organizations/commitments/<slug>`.
 */
export interface Commitment {
  id: Id;
  slug: Slug;
  /**
   * Title Case (`Embedded Evaluators`).
   */
  name: string;
  category: CommitmentCategory;
  /**
   * The place of the column in the table.
   */
  order: number;
  /**
   * One sentence that tells the ideal form.
   */
  summary: Markdown;
  /**
   * Why it matters for safety, in 2 or 3 short sentences.
   */
  description: Markdown;
  /**
   * @minItems 1
   */
  criteria: [CommitmentCriterion, ...CommitmentCriterion[]];
}
/**
 * One part of the ideal form of a commitment.
 */
export interface CommitmentCriterion {
  /**
   * Unique in the commitment (`deep-access`).
   */
  key: Slug;
  /**
   * A few words in Title Case (`Deep Access`).
   */
  label: string;
  /**
   * One sentence that tells what meets the criterion.
   */
  description: Markdown;
}
/**
 * One organization's current state for one commitment: the state after its newest event, or `none_found` with no events. Its page is `/<organization slug>/commitments/<commitment slug>`.
 */
export interface OrgCommitment {
  id: Id;
  organizationId: Id;
  commitmentId: Id;
  /**
   * The day of the newest research (YYYY-MM-DD).
   */
  checkedAt: string;
  /**
   * The model that did the newest research, with its effort, as "Claude Opus 5.5 (High)".
   */
  checkedBy?: string;
  /**
   * The current state in one sentence, for the table and the lists.
   */
  summary?: Markdown;
  state: CommitmentState;
}
/**
 * An organization's commitment at one time.
 */
export interface CommitmentState {
  level: CommitmentLevel;
  strength?: CommitmentStrength;
  duration?: CommitmentDuration;
  /**
   * When a time-limited commitment ends.
   */
  endDate?: PartialDate;
  /**
   * The condition that the commitment depends on, in a few words (`If all frontier labs agree`). Empty when it has no condition.
   */
  condition?: string;
  /**
   * Each criterion of the commitment by its key. A criterion that is not here is not known.
   */
  criteria: {
    [k: string]: CriterionStatus | undefined;
  };
  /**
   * The keys of the met or partly met criteria that an independent party can check, with a public result. Missing is none.
   */
  verified?: Slug[];
  /**
   * Where the organization is now on each criterion, by its key.
   */
  notes?: {
    [k: string]: CriterionNote | undefined;
  };
  /**
   * The exceptions and limits, each in a few words (`Lab can redact`).
   */
  limits: string[];
}
/**
 * One criterion's state in short words. Each part is a phrase or one short sentence.
 */
export interface CriterionNote {
  /**
   * What the organization commits to or does for the criterion.
   */
  commitment?: string;
  /**
   * What is missing for the criterion to be met and independently verified.
   */
  missing?: string;
}
/**
 * One event in an organization's commitment timeline, with the state after it.
 */
export interface OrgCommitmentEvent {
  id: Id;
  orgCommitmentId: Id;
  /**
   * The place in the timeline, from 0, oldest first.
   */
  order: number;
  date: PartialDate;
  datePrecision: DatePrecision;
  kind: CommitmentEventKind;
  /**
   * A short headline (`Signs agreements with four embedded assessors`).
   */
  title: string;
  /**
   * 1 or 2 short sentences.
   */
  summary?: Markdown;
  quote?: CommitmentQuote;
  /**
   * The shared agreement that the event is part of (`Frontier AI Safety Commitments`).
   */
  agreement?: string;
  /**
   * @minItems 1
   */
  sources: [OrgSource, ...OrgSource[]];
  state: CommitmentState;
}
/**
 * The organization's own words, copied exactly from the source.
 */
export interface CommitmentQuote {
  text: string;
  url: Url;
}
/**
 * A kind of tool that does a set of jobs (sparse autoencoders, probes, LLM monitors). The method page tells which safety use the evals test.
 */
export interface Method {
  id: Id;
  slug: Slug;
  /**
   * Title case (`Sparse Autoencoders`, `LLM Monitors`).
   */
  displayName: string;
  group: MethodGroup;
  /**
   * One sentence. What the method does.
   */
  summary: string;
  /**
   * A few words for lists, next to the name: what the method does (`Read what a model has in mind, as words.`).
   */
  tagline?: string;
  /**
   * Markdown. The safety jobs the method could do, and which evals test them.
   */
  safetyUse: string;
  /**
   * Markdown. Limits a reader must know before comparing variants.
   */
  caveats: string[];
  /**
   * The settings that its artifacts can have.
   */
  params: MethodParam[];
  compare: MethodCompare;
  /**
   * What the expert views say on balance: where they agree and where they disagree. Plain words, 50 words or fewer, with no names and no links.
   */
  expertSummary?: string;
  links: EvalLink[];
}
/**
 * One setting that artifacts of a method can have (`width`, `judgeModel`). A key keeps its meaning for all variants of the method.
 */
export interface MethodParam {
  key: string;
  label: string;
  type: MethodParamType;
  unit?: string;
  description?: string;
}
/**
 * How to compare the variants of a method. Artifacts compete only when they have the same subject and the same value for each `groupBy` key. The `matched` rule of an `EvalSuite` tells how to compare on its evals.
 */
export interface MethodCompare {
  /**
   * `sites`, or `MethodParam` keys (`width`).
   */
  groupBy: string[];
}
/**
 * One recipe or architecture of a method (TopK SAE, Apollo probe). A `baseline` is a simple reference that a variant must beat (raw activations, PCA). A changed recipe is a new variant, with `supersedesId` set to the old one.
 */
export interface MethodVariant {
  id: Id;
  /**
   * Unique in its method.
   */
  slug: Slug;
  methodId: Id;
  /**
   * Title case (`Apollo Probe`, `Chain-of-Thought Judge`).
   */
  displayName: string;
  /**
   * Names in result files (`MatryoshkaBatchTopK`, `matryoshka_batch_topk`).
   */
  aliases: Aliases;
  summary?: string;
  access: MethodAccess;
  baseline: boolean;
  /**
   * The variants that this one combines (a probe that reads SAE latents).
   */
  componentIds: Id[];
  /**
   * The variant that this one replaces.
   */
  supersedesId?: Id;
  /**
   * Settings of this variant only, added to those of its method.
   */
  params: MethodParam[];
  links: EvalLink[];
  /**
   * The prompts of a variant that is an LLM, as the judge prompt of a monitor.
   */
  prompts?: MethodPrompt[];
  /**
   * Left out, `public`. Anyone with the link can open an unlisted variant.
   */
  visibility?: Visibility;
}
/**
 * One prompt of a variant, word for word.
 */
export interface MethodPrompt {
  /**
   * What the prompt is for (`Judge prompt`).
   */
  name: string;
  /**
   * The prompt. A `{name}` part is filled in for each call.
   */
  text: string;
  /**
   * How the filled-in parts are made, for example the format of the transcript.
   */
  note?: string;
  /**
   * Where the prompt comes from.
   */
  sourceUrl?: Url;
}
/**
 * What human experts said about a method, from one public source (a post or paper), with its nuance. The summary and points are ours; quotes are the source's words. A source about two methods has one view in each.
 */
export interface MethodExpertView {
  id: Id;
  /**
   * Unique in its method.
   */
  slug: Slug;
  methodId: Id;
  /**
   * The variants of the method that the source names.
   */
  variantIds: Id[];
  /**
   * Our plain headline for the view.
   */
  title: string;
  /**
   * The authors as the source lists them, short (`Lewis Smith, Neel Nanda and 6 others`).
   */
  byline: string;
  organization?: string;
  publishedDate: PartialDate;
  stance: ExpertStance;
  /**
   * Markdown. What the source found and concluded, in plain words.
   */
  summary: string;
  /**
   * Markdown. The nuance and limits that the source gives.
   */
  points: string[];
  quotes: ExpertQuote[];
  /**
   * The original first, then copies and companion posts.
   *
   * @minItems 1
   */
  sources: [EvalLink, ...EvalLink[]];
  /**
   * When we read the source.
   */
  checkedDate: PartialDate;
}
export interface ExpertQuote {
  /**
   * The words of the source, unchanged.
   */
  text: string;
  sourceUrl: Url;
}
/**
 * One trained SAE or probe, or one monitor setup, for one subject model. Evals score artifacts, not variants.
 */
export interface MethodArtifact {
  id: Id;
  /**
   * A stable key from the source (`gemma-2-2b/l12/w16k/topk/trainer-2`).
   */
  key: string;
  variantId: Id;
  displayName: string;
  /**
   * The model that the artifact inspects, as its Hub name (`google/gemma-2-2b`), or the name of a synthetic model.
   */
  subject: string;
  /**
   * The `Model`, when the subject is in the catalog.
   */
  modelId?: Id;
  /**
   * The Hub revision of the subject.
   */
  revision?: string;
  /**
   * Empty for a variant that does not use activations.
   */
  sites: MethodSite[];
  /**
   * Values for the `MethodParam` keys of the method and variant.
   */
  params: {
    [k: string]: string | number | boolean | undefined;
  };
  license?: string;
  /**
   * Where to get the weights or the setup.
   */
  sourceUrl?: Url;
  /**
   * The files to download, as the weights of a probe. Each has a `url`, a `mirror`, or both.
   */
  files?: MethodArtifactFile[];
}
/**
 * One place in the subject model where an artifact reads or writes.
 */
export interface MethodSite {
  /**
   * The interp-engine address of the point (`resid_post.12`, `resid_post.5.stream-2`). Left out when the source does not say which point it uses.
   */
  address?: string;
  role: MethodSiteRole;
  /**
   * The name that the source uses (`blocks.12.hook_resid_post`, `layer 58`).
   */
  source: string;
}
/**
 * One file of an artifact.
 */
export interface MethodArtifactFile {
  /**
   * The file name (`l_48_lm_500000_ar_lr.pt`).
   */
  name: string;
  /**
   * The file at its source, at a fixed commit.
   */
  url?: Url;
  sha256: Sha256;
  bytes: number;
  /**
   * The key of our copy in R2. `apps/web/scripts/mirror-artifact-files.ts` uploads the file and sets it.
   */
  mirror?: string;
}
/**
 * One number for one artifact on one eval version, as the source gives it.
 */
export interface MethodResult {
  id: Id;
  artifactId: Id;
  evalVersionId: Id;
  /**
   * A `MetricDef` key of the eval version.
   */
  metric: string;
  value: number;
  stderr?: number;
  /**
   * The number of samples.
   */
  n?: number;
  /**
   * The result file or paper.
   */
  sourceUrl: Url;
  /**
   * The table in the paper (`Table 9`).
   */
  sourceTable?: string;
  /**
   * The commit of the eval code that made the number.
   */
  sourceCommit?: string;
  measuredAt?: Timestamp;
}
/**
 * A lowercase key for a document (`openai-gpt2-blog`).
 */
export type DocumentKey = string;
export type Alias = string;
/**
 * Other names for the record, for search and for matching names in documents.
 */
export type Aliases = Alias[];
/**
 * What a Deploymeter score says about wide public deployment. `approve`: 70 to 100, wide use with normal safeguards or as it is. `limits`: 50 to 69, only with more safeguards or monitoring. `reject`: 0 to 49, limited use only, or not for wide use.
 */
export type DeployVerdict = 'approve' | 'limits' | 'reject';
/**
 * One answer of a judge to the evidence packet. A review has more than one.
 */
export interface DeployReviewSample {
  /**
   * Trust for wide public deployment, from a safety view. A multiple of 5. When the judge abstains, the score it would give; it does not count.
   */
  score: number;
  /**
   * True when the judge cannot give a fair score from the packet.
   */
  abstain?: boolean;
  /**
   * False when the judge found the packet too thin to judge. Only in older panels.
   */
  enoughEvidence?: boolean;
  /**
   * The main point for a general reader, in one sentence.
   */
  headline: string;
  summary: string;
  reasonsFor: string[];
  reasonsAgainst: string[];
  /**
   * The judge's full reply (JSON text).
   */
  reply?: string;
  /**
   * The reasoning that the provider shows: full text, or a summary for some providers. Null when it shows none.
   */
  reasoning?: string | null;
  reasoningTokens?: number;
}
/**
 * After its review, a judge guesses who made the model and which model it is. It shows how well the packet hides them. `rightDeveloper`: the guess names the developer.
 */
export interface DeployGuess {
  developer: string;
  model: string;
  confidence: number;
  rightDeveloper: boolean;
  /**
   * The reasoning that the provider shows for the guess, as in `DeployReviewSample`.
   */
  reasoning?: string | null;
}
/**
 * What the panel's reviews say together, written by one model from the reviews that count.
 */
export interface DeployPanelSummary {
  summary: string;
  agreements: string[];
  disagreements: string[];
}
/**
 * `stored`: we keep the samples (the license allows it). `pointer`: a link to the source revision, and each sample's id and hash. `hash_only`: only a hash of each sample (held out).
 */
export type SampleStorage = 'stored' | 'pointer' | 'hash_only';
export interface EvalSplit {
  /**
   * The split name in the source (`test`, `public`, `private`).
   */
  name: string;
  sampleCount: number;
  storage: SampleStorage;
}
/**
 * Where the samples come from. Give `hfRepo` and `revision`, or `url`.
 */
export interface EvalDataset {
  /**
   * A Hugging Face dataset repo (`cais/MASK`).
   */
  hfRepo?: string;
  /**
   * The commit or tag the samples come from.
   */
  revision?: string;
  url?: Url;
  /**
   * The hash of all samples in order, as the spec serializes them.
   */
  sha256?: Sha256;
  /**
   * An SPDX id when there is one (`cc-by-4.0`), else the license name.
   */
  license?: string;
  /**
   * More data the task loads, for suites that join datasets (AbstentionBench).
   */
  sources?: DatasetSource[];
  /**
   * @minItems 1
   */
  splits: [EvalSplit, ...EvalSplit[]];
}
/**
 * One more place a task loads data from. Give `hfRepo` and `revision`, or `url`.
 */
export interface DatasetSource {
  hfRepo?: string;
  /**
   * The commit the task pins.
   */
  revision?: string;
  /**
   * A file at a pinned commit (a GitHub raw URL).
   */
  url?: Url;
}
export interface SubjectValue {
  /**
   * The Hub name of the subject model, as artifacts give it.
   */
  subject: string;
  value: number;
}
/**
 * A number for each subject model that sorts the leaderboard rows (a capability index).
 */
export interface SubjectOrder {
  label: string;
  sourceUrl: Url;
  sourceTable?: string;
  values: SubjectValue[];
}
/**
 * How an eval of tools defines its positive cases and sets thresholds.
 */
export interface MethodEvalSetup {
  /**
   * Markdown. What counts as a positive case (a lie).
   */
  definition?: string;
  /**
   * Markdown. How each tool sets its threshold before it is scored.
   */
  calibration?: string;
  subjectOrder?: SubjectOrder;
  /**
   * The subject models that rank the variants. A variant needs a result on each to have a rank.
   */
  coreSubjects?: string[];
}
/**
 * A file in our private storage.
 */
export interface FileRef {
  /**
   * The object key (`runs/<run id>/log.eval`).
   */
  key: string;
  bytes: number;
  sha256?: Sha256;
}
/**
 * Who can read a reply that can give dangerous help. `gated`: anyone, but no public share (J-Lens). `restricted`: staff. `withheld`: nobody on the site. The prompt, target and scores stay open.
 */
export type Hazard = 'gated' | 'restricted' | 'withheld';
/**
 * Compare variants at set values of one metric (SAEs at the same L0). A value between the points of a variant is interpolated.
 */
export interface MethodMatch {
  /**
   * The eval that gives the metric.
   */
  eval: Slug;
  metric: string;
  /**
   * @minItems 1
   */
  targets: [number, ...number[]];
  default: number;
}
export interface TextFact {
  value: string;
  source: FactSource;
}
export interface TagsFact {
  value: Tag[];
  source: FactSource;
}
export type Tag = string;
export type FactSourceKind = 'document' | 'hf_config' | 'provider_docs' | 'url' | 'manual';
/**
 * The default models for the LLM jobs that OpenAudit runs itself, from spec/model-ladders.yaml. A tier is a ladder of models of about the same quality and price from different labs, best first. A role uses a tier or its own list. For a target model, a role skips the models of the target's lab.
 */
export interface ModelLadders {
  /**
   * Other name prefixes of a lab, to the prefix that the ladders use (`meta-llama` to `meta`).
   */
  labs: {
    [k: string]: LabPrefix | undefined;
  };
  tiers: {
    [k: string]: ModelTier | undefined;
  };
  roles: {
    [k: string]: LadderRole | undefined;
  };
  /**
   * The models in the ladders that have open weights.
   */
  openWeights?: LadderModel[];
}
/**
 * An OpenRouter model id (`anthropic/claude-sonnet-5.5`).
 */
export type LadderModel = string;
export interface ModelTier {
  description: string;
  /**
   * Best first. At most one model per lab, so that each target gets a model.
   *
   * @minItems 1
   */
  models: [LadderModel, ...LadderModel[]];
}
/**
 * A job and its models. It has a `tier` or `models`, not both.
 */
export interface LadderRole {
  description: string;
  /**
   * The name of a tier in `tiers`.
   */
  tier?: string;
  /**
   * The role's own ladder, best first, in place of a tier.
   *
   * @minItems 1
   */
  models?: [LadderModel, ...LadderModel[]];
}
/**
 * What went wrong. `model_hacking`: a model broke into systems, took credentials or got out of its limits by itself. `model_deception`: a model lied, schemed or hid what it did. `model_misbehavior`: a model did other harmful things that nobody asked for. `suicide_and_delusion`: chats linked to suicide, self-harm or delusions. `sexual_content_with_minors`: sexual chats with minors, or child abuse images. `nonconsensual_images`: sexual or fake images of real people. `false_or_hateful_claims`: the model stated false information or hate. `used_by_attackers`: criminals or state actors used the model for attacks, targeting, influence operations or violence. `safeguards_failed`: the model gave dangerous help, or its safeguards were weak or off. `systems_breached`: attackers got into the organization's systems or accounts. `data_exposed`: the organization leaked user data, keys, code or weights. `prompt_injection`: a product flaw lets outside content control an agent. `privacy_violation`: the organization collected, used or uploaded data without clear consent. `safety_related_cut`: the organization dropped safety commitments, testing, reports, teams or staff.
 */
export type IncidentPrimaryCategory =
  | 'model_hacking'
  | 'model_deception'
  | 'model_misbehavior'
  | 'suicide_and_delusion'
  | 'sexual_content_with_minors'
  | 'nonconsensual_images'
  | 'false_or_hateful_claims'
  | 'used_by_attackers'
  | 'safeguards_failed'
  | 'systems_breached'
  | 'data_exposed'
  | 'prompt_injection'
  | 'privacy_violation'
  | 'safety_related_cut';
