# Generated from spec/schemas by spec/scripts/generate.mjs. Do not edit.

from __future__ import annotations

from datetime import date as date_aliased
from typing import Annotated, Any, Literal

from openaudit_spec.base import SpecModel
from pydantic import AwareDatetime, ConfigDict, Field, RootModel, constr


class CommitmentCategory(
    RootModel[Literal['oversight', 'transparency', 'limits', 'security']]
):
    root: Annotated[
        Literal['oversight', 'transparency', 'limits', 'security'],
        Field(title='CommitmentCategory'),
    ]
    """
    `oversight`: outside people test or check the organization. `transparency`: the organization tells the public or governments what it finds. `limits`: the organization limits or stops its own development. `security`: it protects its models, or gives resources to safety.
    """


class CommitmentLevel(
    RootModel[
        Literal[
            'full', 'partial', 'intent', 'none_found', 'declined', 'dropped', 'broken'
        ]
    ]
):
    root: Annotated[
        Literal[
            'full', 'partial', 'intent', 'none_found', 'declined', 'dropped', 'broken'
        ],
        Field(title='CommitmentLevel'),
    ]
    """
    How far the organization has committed. `full`: it meets all criteria, each independently verified. `partial`: it meets some criteria, has large exceptions, or is not all verified. `intent`: it says it will, with no terms or date. `none_found`: we checked and found no public commitment. `declined`: it publicly refused. `dropped`: it had the commitment, then withdrew it or let it end. `broken`: credible sources report that it did not keep the commitment.
    """


class CommitmentStrength(RootModel[Literal['statement', 'policy', 'agreement', 'law']]):
    root: Annotated[
        Literal['statement', 'policy', 'agreement', 'law'],
        Field(title='CommitmentStrength'),
    ]
    """
    How enforceable the commitment is. `statement`: a post or a talk; it can change at any time. `policy`: in a published policy or framework with a change process. `agreement`: signed with other parties (an accord, a contract, a government agreement). `law`: a law or regulation requires it.
    """


class CommitmentDuration(RootModel[Literal['ongoing', 'time_limited']]):
    root: Annotated[
        Literal['ongoing', 'time_limited'], Field(title='CommitmentDuration')
    ]
    """
    `ongoing`: no end date. `time_limited`: a pilot, or a term with an end date.
    """


class CriterionStatus(RootModel[Literal['met', 'partly', 'not_met']]):
    root: Annotated[Literal['met', 'partly', 'not_met'], Field(title='CriterionStatus')]


class Limit(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class CriterionNote(SpecModel):
    """
    One criterion's state in short words. Each part is a phrase or one short sentence.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    commitment: Annotated[str | None, Field(min_length=1)] = None
    """
    What the organization commits to or does for the criterion.
    """
    missing: Annotated[str | None, Field(min_length=1)] = None
    """
    What is missing for the criterion to be met and independently verified.
    """


class CommitmentEventKind(
    RootModel[
        Literal[
            'announced',
            'expanded',
            'narrowed',
            'renewed',
            'expired',
            'withdrawn',
            'broken',
            'kept',
            'declined',
        ]
    ]
):
    root: Annotated[
        Literal[
            'announced',
            'expanded',
            'narrowed',
            'renewed',
            'expired',
            'withdrawn',
            'broken',
            'kept',
            'declined',
        ],
        Field(title='CommitmentEventKind'),
    ]
    """
    `announced`: the first commitment. `expanded` or `narrowed`: the terms changed. `renewed`: a time-limited commitment continued. `expired`: it ended at its end date. `withdrawn`: the organization dropped it. `broken`: sources report that it was not kept. `kept`: evidence that the organization did what it said (a published report). `declined`: the organization refused.
    """


class Id(RootModel[str]):
    root: Annotated[
        str,
        Field(
            pattern='^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
            title='Id',
        ),
    ]
    """
    A UUIDv7, made by the client that creates the record. Lowercase, with dashes.
    """


class Slug(RootModel[str]):
    root: Annotated[
        str, Field(max_length=64, pattern='^[a-z0-9]+(-[a-z0-9]+)*$', title='Slug')
    ]
    """
    A lowercase name for URLs and lookups (`google`, `01-ai`).
    """


class DocumentKey(RootModel[str]):
    root: Annotated[
        str,
        Field(
            max_length=100, pattern='^[a-z0-9]+([._-][a-z0-9]+)*$', title='DocumentKey'
        ),
    ]
    """
    A lowercase key for a document (`openai-gpt2-blog`).
    """


class PartialDate(RootModel[str]):
    root: Annotated[
        str,
        Field(
            pattern='^\\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\\d|3[01]))?)?$',
            title='PartialDate',
        ),
    ]
    """
    A date only as exact as its source says (YYYY, YYYY-MM or YYYY-MM-DD).
    """


class Timestamp(RootModel[AwareDatetime]):
    root: Annotated[AwareDatetime, Field(title='Timestamp')]
    """
    An RFC 3339 time with a time zone.
    """


class Url(RootModel[str]):
    root: Annotated[str, Field(pattern='^https?://', title='Url')]
    """
    An http or https URL.
    """


class Sha256(RootModel[str]):
    root: Annotated[str, Field(pattern='^[0-9a-f]{64}$', title='Sha256')]
    """
    A SHA-256 digest, lowercase hex.
    """


class Alias(RootModel[str]):
    root: Annotated[str, Field(min_length=1, title='Alias')]


class Aliases(RootModel[list[Alias]]):
    """
    Other names for the record, for search and for matching names in documents.
    """

    root: Annotated[list[Alias], Field(title='Aliases')]
    """
    Other names for the record, for search and for matching names in documents.
    """


class DeployVerdict(RootModel[Literal['approve', 'limits', 'reject']]):
    root: Annotated[
        Literal['approve', 'limits', 'reject'], Field(title='DeployVerdict')
    ]
    """
    What a Deploymeter score says about wide public deployment. `approve`: 70 to 100, wide use with normal safeguards or as it is. `limits`: 50 to 69, only with more safeguards or monitoring. `reject`: 0 to 49, limited use only, or not for wide use.
    """


class ReasonsForItem(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class ReasonsAgainstItem(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class DeployReviewSample(SpecModel):
    """
    One answer of a judge to the evidence packet. A review has more than one.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    score: Annotated[int, Field(ge=0, le=100)]
    """
    Trust for wide public deployment, from a safety view. A multiple of 5. When the judge abstains, the score it would give; it does not count.
    """
    abstain: bool | None = None
    """
    True when the judge cannot give a fair score from the packet.
    """
    enoughEvidence: bool | None = None
    """
    False when the judge found the packet too thin to judge. Only in older panels.
    """
    headline: Annotated[str, Field(min_length=1)]
    """
    The main point for a general reader, in one sentence.
    """
    summary: Annotated[str, Field(min_length=1)]
    reasonsFor: list[ReasonsForItem]
    reasonsAgainst: list[ReasonsAgainstItem]
    reply: str | None = None
    """
    The judge's full reply (JSON text).
    """
    reasoning: str | None = None
    """
    The reasoning that the provider shows: full text, or a summary for some providers. Null when it shows none.
    """
    reasoningTokens: Annotated[int | None, Field(ge=0)] = None


class DeployGuess(SpecModel):
    """
    After its review, a judge guesses who made the model and which model it is. It shows how well the packet hides them. `rightDeveloper`: the guess names the developer.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    developer: str
    model: str
    confidence: Annotated[int, Field(ge=0, le=100)]
    rightDeveloper: bool
    reasoning: str | None = None
    """
    The reasoning that the provider shows for the guess, as in `DeployReviewSample`.
    """


class Agreement(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class Disagreement(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class DeployPanelSummary(SpecModel):
    """
    What the panel's reviews say together, written by one model from the reviews that count.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    summary: Annotated[str, Field(min_length=1)]
    agreements: list[Agreement]
    disagreements: list[Disagreement]


class DocumentKind(
    RootModel[
        Literal[
            'system_card', 'technical_report', 'safety_report', 'model_page', 'blog'
        ]
    ]
):
    root: Annotated[
        Literal[
            'system_card', 'technical_report', 'safety_report', 'model_page', 'blog'
        ],
        Field(title='DocumentKind'),
    ]
    """
    What the document is. A system card and a safety report state the lab's tests. A model page is a short page about a model (specs and use), with no safety tests.
    """


class Document(SpecModel):
    """
    A document an organization published about models: a link, our saved copy of the file and facts we took from it. `url` stays the publisher's link.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    key: DocumentKey
    """
    A readable unique key (`openai-gpt2-blog`).
    """
    kind: DocumentKind
    title: Annotated[str, Field(min_length=1)]
    url: Url
    publisherId: Id
    """
    The `Organization` that published it.
    """
    publishedDate: PartialDate | None = None
    fileUrl: Url | None = None
    """
    Where we got the saved copy, when it is not `url` (the PDF that a web page links to).
    """
    fileKey: Annotated[str | None, Field(min_length=1)] = None
    """
    The saved copy in our storage (`documents/<key>.pdf`).
    """
    fileType: Literal['pdf', 'html'] | None = None
    sha256: Sha256 | None = None
    """
    The hash of the saved copy.
    """
    fetchedAt: Timestamp | None = None
    """
    When we fetched the saved copy.
    """
    verified: bool
    """
    A person checked that the link works and that the publisher is correct.
    """
    notes: str | None = None
    """
    Notes for reviewers. Not shown on public pages.
    """


class Visibility(RootModel[Literal['private', 'unlisted', 'public']]):
    root: Annotated[Literal['private', 'unlisted', 'public'], Field(title='Visibility')]
    """
    `private`: the owner only. `unlisted`: anyone with the link; never listed or indexed. `public`: listed and indexed. A record is never more visible than its parent.
    """


class EvalAccess(RootModel[Literal['public', 'gated', 'held_out', 'lab_internal']]):
    root: Annotated[
        Literal['public', 'gated', 'held_out', 'lab_internal'],
        Field(title='EvalAccess'),
    ]
    """
    Who can get the samples. `public`: anyone. `gated`: after agreeing to the source's terms. `held_out`: kept back by the maintainer. `lab_internal`: only the lab has it; we store the record so reported results can link to it, and never run it.
    """


class EvalStatus(RootModel[Literal['active', 'saturated', 'legacy', 'retired']]):
    root: Annotated[
        Literal['active', 'saturated', 'legacy', 'retired'], Field(title='EvalStatus')
    ]
    """
    `active`: current, and we recommend it. `saturated`: valid, but current models score at the ceiling or the floor. `legacy`: dated, replaced, or with known validity problems; you can still run it for history, but we do not recommend it by default. `retired`: withdrawn; do not run it.
    """


class Measures(RootModel[Literal['capability', 'propensity', 'robustness']]):
    root: Annotated[
        Literal['capability', 'propensity', 'robustness'], Field(title='Measures')
    ]
    """
    `capability`: can the subject do it. `propensity`: does it tend to. `robustness`: can its safeguards be broken.
    """


class EvalFormat(RootModel[Literal['single_turn', 'multi_turn', 'agentic']]):
    root: Annotated[
        Literal['single_turn', 'multi_turn', 'agentic'], Field(title='EvalFormat')
    ]


class EvalCases(RootModel[Literal['fixed', 'generated', 'live_human']]):
    root: Annotated[
        Literal['fixed', 'generated', 'live_human'], Field(title='EvalCases')
    ]
    """
    `fixed`: a dataset. `generated`: an auditor model writes the conversation from a seed. `live_human`: people talk to the subject.
    """


class Grading(RootModel[Literal['programmatic', 'model_judge', 'human']]):
    root: Annotated[
        Literal['programmatic', 'model_judge', 'human'], Field(title='Grading')
    ]


class SubjectKind(RootModel[Literal['model', 'auditor', 'method']]):
    root: Annotated[Literal['model', 'auditor', 'method'], Field(title='SubjectKind')]
    """
    What a run tests. `model`: a model. `auditor`: an agent (model, tools, scaffold) that audits target models. `method`: an interp method on a model, with its artifact (SAE, vector, probe).
    """


class Topic(
    RootModel[
        Literal[
            'harmful_requests',
            'child_safety',
            'self_harm',
            'jailbreaks',
            'prompt_injection',
            'agentic_misuse',
            'hallucination',
            'honesty',
            'sycophancy',
            'bias',
            'toxicity',
            'reward_hacking',
            'eval_awareness',
            'situational_awareness',
            'cot_monitorability',
            'sabotage',
            'manipulation',
            'power_seeking',
            'welfare',
            'cyber',
            'bio_chem',
            'auditing',
        ]
    ]
):
    root: Annotated[
        Literal[
            'harmful_requests',
            'child_safety',
            'self_harm',
            'jailbreaks',
            'prompt_injection',
            'agentic_misuse',
            'hallucination',
            'honesty',
            'sycophancy',
            'bias',
            'toxicity',
            'reward_hacking',
            'eval_awareness',
            'situational_awareness',
            'cot_monitorability',
            'sabotage',
            'manipulation',
            'power_seeking',
            'welfare',
            'cyber',
            'bio_chem',
            'auditing',
        ],
        Field(title='Topic'),
    ]
    """
    What an eval is about. The same list tags system-card coverage.
    """


class EvalFacets(SpecModel):
    """
    Independent answers to one question each. Labels such as "benchmark" or "red team" are combinations of these.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    measures: Annotated[list[Measures], Field(min_length=1)]
    formats: Annotated[list[EvalFormat], Field(min_length=1)]
    cases: Annotated[list[EvalCases], Field(min_length=1)]
    grading: Annotated[list[Grading], Field(min_length=1)]
    adversarial: bool
    """
    The eval tries to make the subject fail (red teaming, jailbreaks).
    """
    humanParticipants: bool
    """
    People take part, as in uplift trials.
    """
    subjects: Annotated[list[SubjectKind], Field(min_length=1)]
    topics: list[Topic]


class EvalMaintainer(SpecModel):
    """
    Who maintains the eval. Give `organizationId` when the maintainer is an `Organization`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(min_length=1)]
    organizationId: Id | None = None
    url: Url | None = None


class RecommendedModel(SpecModel):
    """
    A model we recommend for one role in an eval, in place of its default. We tested it on some samples and its results agreed with the default model's results.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    role: Annotated[str, Field(min_length=1)]
    """
    The role, as the eval's task names it (`judge`, `auditor`, `grader`).
    """
    model: Annotated[str, Field(min_length=1)]
    """
    The model, as OpenRouter names it (`google/gemini-2.5-flash-lite`).
    """
    recommendedAt: PartialDate
    """
    The day we made the recommendation (YYYY-MM-DD).
    """
    replaces: Annotated[str | None, Field(min_length=1)] = None
    """
    The default model for the role (`openai/gpt-4-turbo`).
    """
    version: Annotated[str | None, Field(min_length=1)] = None
    """
    The eval version that we tested.
    """
    evidence: Annotated[str, Field(min_length=1)]
    """
    Markdown. What we tested (samples, agreement, cost) and the run ids.
    """


class EvalLinkKind(
    RootModel[
        Literal[
            'paper',
            'repo',
            'dataset',
            'hf_benchmark',
            'leaderboard',
            'homepage',
            'blog',
            'error_report',
        ]
    ]
):
    root: Annotated[
        Literal[
            'paper',
            'repo',
            'dataset',
            'hf_benchmark',
            'leaderboard',
            'homepage',
            'blog',
            'error_report',
        ],
        Field(title='EvalLinkKind'),
    ]
    """
    `hf_benchmark`: a Hugging Face benchmark dataset repo, for Community Evals. `error_report`: our report of dataset errors to the maintainers; the Known Errors page links it.
    """


class EvalLink(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    kind: EvalLinkKind
    url: Url
    title: Annotated[str | None, Field(min_length=1)] = None


class Eval(SpecModel):
    """
    A test of models, auditors or interp methods: a benchmark, a red team, an automated audit. Results point to one of its `EvalVersion`s.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    """
    The name in URLs (`petri`, `mask`). Unique on the site.
    """
    displayName: Annotated[str, Field(min_length=1)]
    aliases: Aliases
    """
    Other spellings in documents (`Model Alignment between Statements and Knowledge`).
    """
    description: Annotated[str | None, Field(min_length=1)] = None
    """
    A short Markdown description.
    """
    summary: Annotated[str | None, Field(max_length=200, min_length=1)] = None
    """
    One plain sentence about what the eval tests, for lists and tables ("Tests whether the model lies under pressure about what it believes is true.").
    """
    family: Annotated[str | None, Field(min_length=1)] = None
    """
    Groups related evals (`Petri` for Petri and Petri Bloom suites).
    """
    suiteId: Id | None = None
    """
    The `EvalSuite` that the eval is part of.
    """
    maintainers: list[EvalMaintainer]
    links: list[EvalLink]
    access: EvalAccess
    status: EvalStatus
    saturatedReason: Annotated[str | None, Field(min_length=1)] = None
    """
    One line on why we marked it `saturated` (`Current models refuse almost every prompt.`). Markdown.
    """
    saturatedDecisionDate: date_aliased | None = None
    """
    The day we marked it `saturated` (YYYY-MM-DD).
    """
    legacyReason: Annotated[str | None, Field(min_length=1)] = None
    """
    One line on why we marked it `legacy` (`Built for base-model continuation; chat models score near zero.`). Markdown.
    """
    legacyDecisionDate: date_aliased | None = None
    """
    The day we marked it `legacy` (YYYY-MM-DD).
    """
    supersededBy: Slug | None = None
    """
    The slug of the newer eval to use in place of this one.
    """
    autoApprove: bool | None = None
    """
    A full run costs little, so a user's request of it starts without an admin's approval (when its estimated cost is under the limit).
    """
    facets: EvalFacets
    recommendedModels: list[RecommendedModel] | None = None
    """
    Cheaper judge or helper models that we tested against the defaults.
    """
    canary: Annotated[str | None, Field(min_length=1)] = None
    """
    The eval's canary string. We show it on each page, so training filters can drop them.
    """
    ownerUserId: Id | None = None
    """
    The user who made it. Left out for evals in the site registry (seed data).
    """
    visibility: Visibility
    """
    A private eval needs an owner. Anyone with the link can open an unlisted eval.
    """


class EvalVersionStatus(RootModel[Literal['draft', 'published']]):
    root: Annotated[Literal['draft', 'published'], Field(title='EvalVersionStatus')]
    """
    `draft`: can change. `published`: fixed, but its `runner` can change and it can add metrics; results point only to published versions.
    """


class SampleStorage(RootModel[Literal['stored', 'pointer', 'hash_only']]):
    root: Annotated[
        Literal['stored', 'pointer', 'hash_only'], Field(title='SampleStorage')
    ]
    """
    `stored`: we keep the samples (the license allows it). `pointer`: a link to the source revision, and each sample's id and hash. `hash_only`: only a hash of each sample (held out).
    """


class EvalSplit(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(min_length=1)]
    """
    The split name in the source (`test`, `public`, `private`).
    """
    sampleCount: Annotated[int, Field(ge=0)]
    storage: SampleStorage


class DatasetSource(SpecModel):
    """
    One more place a task loads data from. Give `hfRepo` and `revision`, or `url`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    hfRepo: Annotated[str | None, Field(pattern='^[^/\\s]+/[^/\\s]+$')] = None
    revision: Annotated[str | None, Field(min_length=1)] = None
    """
    The commit the task pins.
    """
    url: Url | None = None
    """
    A file at a pinned commit (a GitHub raw URL).
    """


class DisplayRule(RootModel[Literal['open', 'sign_in', 'scores_only']]):
    root: Annotated[
        Literal['open', 'sign_in', 'scores_only'], Field(title='DisplayRule')
    ]
    """
    Who can read sample text: inputs, targets, transcripts and logs. `open`: anyone. `sign_in`: signed-in users who accepted the dataset's terms on our site. `scores_only`: nobody; pages show only scores and pass or fail.
    """


class SubsetTerms(SpecModel):
    """
    A rule for the samples whose metadata `key` equals `value` (a dataset inside a suite).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(min_length=1)]
    """
    The sample metadata key, as the Inspect task sets it (`dataset_name`).
    """
    value: Annotated[str, Field(min_length=1)]
    display: DisplayRule
    quote: Annotated[str | None, Field(min_length=1)] = None
    """
    The terms, as the source states them.
    """
    source: Url


class SampleTerms(SpecModel):
    """
    The source's terms on showing its samples, and our rule for them. Left out: `open`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    display: DisplayRule
    quote: Annotated[str | None, Field(min_length=1)] = None
    """
    The terms, as the source states them. Left out when the source states none.
    """
    source: Url
    """
    Where the terms are (the gate page or the README).
    """
    note: Annotated[str | None, Field(min_length=1)] = None
    """
    Why this rule, when the quote alone does not say.
    """
    subsets: list[SubsetTerms] | None = None
    """
    Rules for some samples. A matching rule replaces `display` for those samples.
    """


class ScoreType(RootModel[Literal['binary', 'ordinal', 'continuous']]):
    root: Annotated[
        Literal['binary', 'ordinal', 'continuous'], Field(title='ScoreType')
    ]
    """
    `binary`: 0 or 1 (pass). `ordinal`: whole steps from `min` to `max` (a 1-10 judge scale). `continuous`: any number, in `[min, max]` when given.
    """


class Direction(
    RootModel[
        Literal[
            'higher_is_better', 'lower_is_better', 'nearer_zero_is_better', 'neither'
        ]
    ]
):
    root: Annotated[
        Literal[
            'higher_is_better', 'lower_is_better', 'nearer_zero_is_better', 'neither'
        ],
        Field(title='Direction'),
    ]
    """
    `nearer_zero_is_better`: a signed number where 0 is best and both signs are worse.
    """


class Group(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class PassRule(SpecModel):
    """
    When one attempt's value of this score is a pass or a fail, if the direction cannot tell. The runner marks each attempt by the rule of its headline score, and the attempt page marks each score. With no rule, the direction decides: see `ADD_AN_EVAL.md`. A value that the rule does not name has no mark.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    values: dict[str, bool] | None = None
    """
    Each value as text and its mark: true for a pass (MASK: `honest` true, `lie` false). Case and spaces at the ends do not count. A number is its shortest text (`1`, `0.5`).
    """
    byTarget: dict[str, dict[str, bool]] | None = None
    """
    For each sample target, the values and their marks, as in `values` (AbstentionBench: with the target `True`, `yes` is a pass).
    """
    failAtOrAbove: float | None = None
    """
    A number at this value or above is a fail, and a lower number is a pass (Petri's 1 to 10 scale, 7).
    """
    groups: Annotated[list[Group] | None, Field(min_length=1)] = None
    """
    The group metric keys that the rule is for. An attempt in none of them has no mark (APE: only the harmful topics).
    """
    none: Literal[True] | None = None
    """
    No mark on any value, for a score that is not good or bad for safety by itself.
    """


class MetricAggregation(RootModel[Literal['mean', 'rate', 'pass_at_k', 'custom']]):
    root: Annotated[
        Literal['mean', 'rate', 'pass_at_k', 'custom'], Field(title='MetricAggregation')
    ]
    """
    How attempts become one number. `mean`: the mean of a score. `rate`: the share of attempts whose binary score is 1. `pass_at_k`: pass@k over trials. `custom`: the eval's own formula (see `description`).
    """


class MetricDef(SpecModel):
    """
    One aggregate number an `EvalResult` can hold.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(pattern='^[a-z][a-z0-9_@]*$')]
    displayName: Annotated[str, Field(min_length=1)]
    score: str | None = None
    """
    The `ScoreDef.key` it comes from. Left out for `custom`.
    """
    aggregation: MetricAggregation
    k: Annotated[int | None, Field(ge=1)] = None
    """
    For `pass_at_k`.
    """
    unit: Annotated[str | None, Field(min_length=1)] = None
    """
    Left out for a plain number or a fraction (`percent`, `tokens`).
    """
    min: float | None = None
    max: float | None = None
    direction: Direction
    """
    Which way is better for the eval's own goal. For a skill eval, more skill.
    """
    safetyDirection: Direction | None = None
    """
    Which way is better for safety, as in `EvalResult.safetyDirection`; measured results get it. `neither` for skill metrics (dangerous skills too) and for refusals of safe requests.
    """
    headline: bool | None = None
    """
    The number to show first. At most one per version.
    """
    description: Annotated[str | None, Field(min_length=1)] = None


class ModelRole(
    RootModel[Literal['target', 'auditor', 'judge', 'monitor', 'generator']]
):
    root: Annotated[
        Literal['target', 'auditor', 'judge', 'monitor', 'generator'],
        Field(title='ModelRole'),
    ]
    """
    A model's part in a run, as Inspect's `model_roles`. `target`: the model under test. `auditor`: writes the other side of the conversation. `judge`: scores. `monitor`: watches the target for bad actions. `generator`: writes samples.
    """


class RunnerKind(RootModel[Literal['inspect', 'openaudit', 'external']]):
    root: Annotated[
        Literal['inspect', 'openaudit', 'external'], Field(title='RunnerKind')
    ]
    """
    `inspect`: an Inspect task. `openaudit`: our runner. `external`: the maintainer's own code.
    """


class Dependency(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class SubjectValue(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    subject: Annotated[str, Field(min_length=1)]
    """
    The Hub name of the subject model, as artifacts give it.
    """
    value: float


class SubjectOrder(SpecModel):
    """
    A number for each subject model that sorts the leaderboard rows (a capability index).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    label: Annotated[str, Field(min_length=1)]
    sourceUrl: Url
    sourceTable: Annotated[str | None, Field(min_length=1)] = None
    values: list[SubjectValue]


class CoreSubject(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class MethodEvalSetup(SpecModel):
    """
    How an eval of tools defines its positive cases and sets thresholds.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    definition: Annotated[str | None, Field(min_length=1)] = None
    """
    Markdown. What counts as a positive case (a lie).
    """
    calibration: Annotated[str | None, Field(min_length=1)] = None
    """
    Markdown. How each tool sets its threshold before it is scored.
    """
    subjectOrder: SubjectOrder | None = None
    coreSubjects: list[CoreSubject] | None = None
    """
    The subject models that rank the variants. A variant needs a result on each to have a rank.
    """


class ResultOrigin(RootModel[Literal['reported', 'measured']]):
    root: Annotated[Literal['reported', 'measured'], Field(title='ResultOrigin')]
    """
    `reported`: from a document (give `source`). `measured`: from an `EvalRun`.
    """


class ResultSettings(SpecModel):
    """
    How the number was made. Compare results only when these match. Left out: not stated.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    reasoningEffort: Annotated[str | None, Field(min_length=1)] = None
    """
    The lab's words (`high`, `max`, `no thinking`).
    """
    tools: bool | None = None
    passAtK: Annotated[int | None, Field(ge=1)] = None
    trials: Annotated[int | None, Field(ge=1)] = None
    harness: Annotated[str | None, Field(min_length=1)] = None
    """
    The scaffold or agent (`Claude Code`, `Terminus 2`).
    """
    safeguards: bool | None = None
    """
    Production safeguards (classifiers) were on.
    """
    helpfulOnly: bool | None = None
    """
    A helpful-only model, without safety training.
    """
    surface: Annotated[str | None, Field(min_length=1)] = None
    """
    Where it ran (`API`, `ChatGPT`).
    """
    otherModels: Annotated[str | None, Field(min_length=1)] = None
    """
    The judge and other models besides the target, as `slot: model` pairs (`judge: openai/gpt-4o`). Scores with different judges are not comparable.
    """
    other: Annotated[str | None, Field(min_length=1)] = None
    """
    Anything else the source says about the setup.
    """


class ResultSource(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    documentId: Id
    page: Annotated[str | None, Field(min_length=1)] = None
    """
    The page or section, as printed in the document.
    """
    pdfPage: Annotated[int | None, Field(ge=1)] = None
    """
    The page in the document's saved PDF, from 1. Links go here.
    """
    table: Annotated[str | None, Field(min_length=1)] = None
    """
    The table or figure (`Table 4`, `Figure 2.3.A`).
    """
    quote: Annotated[str | None, Field(min_length=1)] = None


class EvalResult1(SpecModel):
    modelId: Any


class EvalResult2(SpecModel):
    rawModelName: Any


class RunStatus(
    RootModel[
        Literal[
            'requested',
            'queued',
            'running',
            'importing',
            'succeeded',
            'failed',
            'cancelled',
        ]
    ]
):
    root: Annotated[
        Literal[
            'requested',
            'queued',
            'running',
            'importing',
            'succeeded',
            'failed',
            'cancelled',
        ],
        Field(title='RunStatus'),
    ]
    """
    `requested`: a user asked for it; it waits for an admin to approve it. `queued`: waits for a runner. `running`: a runner has it. `importing`: the log is being saved. `succeeded`, `failed`, `cancelled`: done.
    """


class RunOrigin(RootModel[Literal['run', 'import', 'rescore']]):
    root: Annotated[Literal['run', 'import', 'rescore'], Field(title='RunOrigin')]
    """
    `run`: our runner ran it. `import`: a log made elsewhere, imported. `rescore`: our runner scored the outputs of `sourceRunId` again, with other scoring models.
    """


class RouteKind(
    RootModel[Literal['direct', 'openrouter', 'bedrock', 'vertex', 'azure', 'engine']]
):
    root: Annotated[
        Literal['direct', 'openrouter', 'bedrock', 'vertex', 'azure', 'engine'],
        Field(title='RouteKind'),
    ]
    """
    How the target model was served. `direct`: the lab's own API. `openrouter`, `bedrock`, `vertex`, `azure`: that router or cloud. `engine`: our interp-engine server.
    """


class Provider(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class Fallback(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class ServingRoute(SpecModel):
    """
    How a run reached the model. Provenance and a filter; not a change to the model.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: RouteKind
    model: Annotated[str, Field(min_length=1)]
    """
    The model id on the route (`qwen/qwen3.6-27b`).
    """
    providers: list[Provider] | None = None
    """
    The providers the router may use, in order (OpenRouter `provider.order`).
    """
    allowFallbacks: bool | None = None
    fallbacks: list[Fallback] | None = None
    """
    For a slot: other models to try, in order, when this model fails a call or refuses it (an error, a content filter or an empty reply).
    """
    quantization: Annotated[str | None, Field(min_length=1)] = None
    """
    The weights' precision as the route states it (`bf16`, `fp8`, `unknown`).
    """


class RunSettings(SpecModel):
    """
    What the runner was asked to do. Left out: the task's default.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    reasoning: (
        Literal['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'on'] | None
    ) = None
    """
    Thinking effort, in OpenRouter's words. `none`: no thinking. `on`: thinking at the model's default, for models with no effort levels.
    """
    limit: Annotated[int | None, Field(ge=1)] = None
    """
    Run only the first samples of the dataset.
    """
    epochs: Annotated[int | None, Field(ge=1)] = None
    maxConnections: Annotated[int | None, Field(ge=1)] = None
    """
    Parallel model calls in each shard.
    """
    shardSize: Annotated[int | None, Field(ge=1)] = None
    """
    Samples in each shard. Left out, the runner's default.
    """
    capKey: Annotated[str | None, Field(min_length=1)] = None
    """
    The `runner_cap` key for the run's shards, for one cap per model server. Left out: from the route.
    """
    temperature: Annotated[float | None, Field(ge=0.0)] = None
    maxTokens: Annotated[int | None, Field(ge=1)] = None
    taskArgs: dict[str, Any] | None = None
    """
    Arguments for the task (`{"target": "mc1"}`).
    """
    models: dict[constr(pattern=r'^[a-z][a-z0-9_]*$'), ServingRoute] | None = None
    """
    The model for each slot in the version's `runner.models`, by slot id.
    """


class TokenUsage(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    input: Annotated[int | None, Field(ge=0)] = None
    output: Annotated[int | None, Field(ge=0)] = None
    reasoning: Annotated[int | None, Field(ge=0)] = None
    """
    Part of `output`.
    """
    cacheRead: Annotated[int | None, Field(ge=0)] = None
    """
    Input tokens read from the provider's prompt cache. Part of `input`.
    """
    cacheWrite: Annotated[int | None, Field(ge=0)] = None
    """
    Input tokens written to the provider's prompt cache. Part of `input`.
    """


class FileRef(SpecModel):
    """
    A file in our private storage.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(min_length=1)]
    """
    The object key (`runs/<run id>/log.eval`).
    """
    bytes: Annotated[int, Field(ge=0)]
    sha256: Sha256 | None = None


class ServedByItem(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class ProviderBlock(SpecModel):
    """
    Samples whose model calls a provider refused for its policy (not the model's own refusal). These samples have no score.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    provider: Annotated[str, Field(min_length=1)]
    """
    The provider that refused (`Meta`, `OpenAI`), or `unknown`.
    """
    kind: Literal['account', 'content']
    """
    `account`: the provider blocked our account, so it refuses all calls. `content`: it refused these prompts only.
    """
    code: Annotated[str | None, Field(min_length=1)] = None
    """
    The provider's error code (`user_blocked`, `data_inspection_failed`).
    """
    message: Annotated[str | None, Field(min_length=1)] = None
    model: Annotated[str | None, Field(min_length=1)] = None
    """
    The model of the refused calls, when the error names it.
    """
    samples: Annotated[int, Field(ge=0)]
    """
    The samples with this block. Zero when the run stopped before its samples.
    """


class FallbackUse(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    slot: Annotated[str, Field(pattern='^[a-z][a-z0-9_]*$')]
    model: Annotated[str, Field(min_length=1)]
    calls: Annotated[int, Field(ge=1)]


class ModelUsage(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    tokens: TokenUsage | None = None
    costUsd: Annotated[float | None, Field(ge=0.0)] = None
    costEstimated: bool | None = None
    """
    The route did not state the cost; `costUsd` is list price times tokens.
    """
    servedBy: list[ServedByItem] | None = None


class AttemptStatus(RootModel[Literal['success', 'error']]):
    root: Annotated[Literal['success', 'error'], Field(title='AttemptStatus')]


class AttemptScore(SpecModel):
    """
    One scorer's grade of an attempt, as Inspect's `Score`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    value: float | str | bool
    """
    A number, a letter (`C` correct, `I` incorrect), or a yes/no.
    """
    answer: str | None = None
    """
    The answer the scorer read from the output.
    """
    explanation: str | None = None


class Hazard(RootModel[Literal['gated', 'restricted', 'withheld']]):
    root: Annotated[Literal['gated', 'restricted', 'withheld'], Field(title='Hazard')]
    """
    Who can read a reply that can give dangerous help. `gated`: anyone, but no public share (J-Lens). `restricted`: staff. `withheld`: nobody on the site. The prompt, target and scores stay open.
    """


class EvalAttempt(SpecModel):
    """
    One sample in one epoch of a run: a short copy of the input and output for lists, the scores, and the full transcript in `body`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    runId: Id
    ordinal: Annotated[int, Field(ge=1)]
    """
    The attempt's place in the log, from 1. URLs use it.
    """
    sampleId: Annotated[str, Field(min_length=1)]
    """
    The sample's id in the log.
    """
    evalSampleId: Id | None = None
    """
    The stored `EvalSample`, when we keep the samples.
    """
    epoch: Annotated[int, Field(ge=1)]
    status: AttemptStatus
    passed: bool | None = None
    """
    The headline score is correct. Left out when the score is not pass or fail.
    """
    input: str | None = None
    """
    The first user message, shortened.
    """
    target: str | list[str] | None = None
    choices: list[str] | None = None
    output: str | None = None
    """
    The final answer, shortened.
    """
    scores: dict[str, AttemptScore]
    """
    By scorer name.
    """
    metrics: list[str] | None = None
    """
    The keys of the metrics over a part of the samples (a category or group) that count this attempt, such as `harm_score_copyright`.
    """
    error: Annotated[str | None, Field(min_length=1)] = None
    notScored: Annotated[str | None, Field(min_length=1)] = None
    """
    Why the attempt has no scores, from the sample's `notScored` metadata.
    """
    tokens: TokenUsage | None = None
    seconds: Annotated[float | None, Field(ge=0.0)] = None
    display: DisplayRule | None = None
    """
    A subset rule that matched this sample. Left out, the version's rule applies.
    """
    hazard: Hazard | None = None
    """
    Set from the dataset's labels when the eval graded the reply unsafe. Left out, open.
    """
    body: FileRef | None = None
    """
    The attempt's `Transcript` as JSON.
    """


class SampleMessage(SpecModel):
    """
    One chat message of a sample's input. Text only.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    role: Literal['system', 'user', 'assistant', 'tool']
    content: str


class Input(RootModel[list[SampleMessage]]):
    root: Annotated[list[SampleMessage], Field(min_length=1)]
    """
    A prompt, or chat messages.
    """


class EvalSample(SpecModel):
    """
    One sample of an eval version, as Inspect's `Sample`. Each split keeps `sourceId` and `sha256`; only a `stored` split also keeps `input`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    evalVersionId: Id
    split: Annotated[str, Field(min_length=1)]
    """
    An `EvalSplit.name` of the version.
    """
    sourceId: Annotated[str, Field(min_length=1)]
    """
    The sample's id in the source. Unique in its split.
    """
    input: str | Input | None = None
    """
    A prompt, or chat messages.
    """
    target: str | list[str] | None = None
    """
    The answer or answers the scorer looks for.
    """
    choices: list[str] | None = None
    """
    The options of a multiple-choice sample.
    """
    metadata: dict[str, Any]
    """
    Other fields of the source sample, as they are in the source.
    """
    sha256: Annotated[str, Field(pattern='^[0-9a-f]{64}$')]
    """
    The hash of `{"id": sourceId, "input": input}` as JSON with sorted keys and no spaces. Chat input is `SampleMessage[]`.
    """


class MethodGroup(RootModel[Literal['white_box', 'black_box']]):
    root: Annotated[Literal['white_box', 'black_box'], Field(title='MethodGroup')]
    """
    What the method reads. `white_box`: activations, weights or token log probs (it needs model access). `black_box`: only text. Topics, not groups, tell the job of a method.
    """


class ExpertStance(RootModel[Literal['positive', 'negative', 'mixed']]):
    root: Annotated[
        Literal['positive', 'negative', 'mixed'], Field(title='ExpertStance')
    ]
    """
    What a view says about its method, on balance.
    """


class ExpertQuote(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    text: Annotated[str, Field(min_length=1)]
    """
    The words of the source, unchanged.
    """
    sourceUrl: Url


class MethodAccess(RootModel[Literal['white_box', 'logprobs', 'black_box']]):
    root: Annotated[
        Literal['white_box', 'logprobs', 'black_box'], Field(title='MethodAccess')
    ]
    """
    What a variant needs from the subject model. `white_box`: activations or weights. `logprobs`: token log probabilities only. `black_box`: text in and out only.
    """


class MethodParamType(RootModel[Literal['integer', 'number', 'string', 'boolean']]):
    root: Annotated[
        Literal['integer', 'number', 'string', 'boolean'],
        Field(title='MethodParamType'),
    ]


class MethodParam(SpecModel):
    """
    One setting that artifacts of a method can have (`width`, `judgeModel`). A key keeps its meaning for all variants of the method.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(pattern='^[a-z][a-zA-Z0-9]*$')]
    label: Annotated[str, Field(min_length=1)]
    type: MethodParamType
    unit: Annotated[str | None, Field(min_length=1)] = None
    description: Annotated[str | None, Field(min_length=1)] = None


class MethodMatch(SpecModel):
    """
    Compare variants at set values of one metric (SAEs at the same L0). A value between the points of a variant is interpolated.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    eval: Slug
    """
    The eval that gives the metric.
    """
    metric: Annotated[str, Field(min_length=1)]
    targets: Annotated[list[float], Field(min_length=1)]
    default: float


class GroupByItem(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class MethodCompare(SpecModel):
    """
    How to compare the variants of a method. Artifacts compete only when they have the same subject and the same value for each `groupBy` key. The `matched` rule of an `EvalSuite` tells how to compare on its evals.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    groupBy: list[GroupByItem]
    """
    `sites`, or `MethodParam` keys (`width`).
    """


class Caveat(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class Method(SpecModel):
    """
    A kind of tool that does a set of jobs (sparse autoencoders, probes, LLM monitors). The method page tells which safety use the evals test.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    displayName: Annotated[str, Field(min_length=1)]
    """
    Title case (`Sparse Autoencoders`, `LLM Monitors`).
    """
    group: MethodGroup
    summary: Annotated[str, Field(min_length=1)]
    """
    One sentence. What the method does.
    """
    tagline: Annotated[str | None, Field(max_length=60, min_length=1)] = None
    """
    A few words for lists, next to the name: what the method does (`Read what a model has in mind, as words.`).
    """
    safetyUse: Annotated[str, Field(min_length=1)]
    """
    Markdown. The safety jobs the method could do, and which evals test them.
    """
    caveats: list[Caveat]
    """
    Markdown. Limits a reader must know before comparing variants.
    """
    params: list[MethodParam]
    """
    The settings that its artifacts can have.
    """
    compare: MethodCompare
    expertSummary: Annotated[str | None, Field(min_length=1)] = None
    """
    What the expert views say on balance: where they agree and where they disagree. Plain words, 50 words or fewer, with no names and no links.
    """
    links: list[EvalLink]


class MethodPrompt(SpecModel):
    """
    One prompt of a variant, word for word.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(min_length=1)]
    """
    What the prompt is for (`Judge prompt`).
    """
    text: Annotated[str, Field(min_length=1)]
    """
    The prompt. A `{name}` part is filled in for each call.
    """
    note: Annotated[str | None, Field(min_length=1)] = None
    """
    How the filled-in parts are made, for example the format of the transcript.
    """
    sourceUrl: Url | None = None
    """
    Where the prompt comes from.
    """


class Point(RootModel[str]):
    root: Annotated[str, Field(min_length=1)]


class MethodExpertView(SpecModel):
    """
    What human experts said about a method, from one public source (a post or paper), with its nuance. The summary and points are ours; quotes are the source's words. A source about two methods has one view in each.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    """
    Unique in its method.
    """
    methodId: Id
    variantIds: list[Id]
    """
    The variants of the method that the source names.
    """
    title: Annotated[str, Field(min_length=1)]
    """
    Our plain headline for the view.
    """
    byline: Annotated[str, Field(min_length=1)]
    """
    The authors as the source lists them, short (`Lewis Smith, Neel Nanda and 6 others`).
    """
    organization: Annotated[str | None, Field(min_length=1)] = None
    publishedDate: PartialDate
    stance: ExpertStance
    summary: Annotated[str, Field(min_length=1)]
    """
    Markdown. What the source found and concluded, in plain words.
    """
    points: list[Point]
    """
    Markdown. The nuance and limits that the source gives.
    """
    quotes: list[ExpertQuote]
    sources: Annotated[list[EvalLink], Field(min_length=1)]
    """
    The original first, then copies and companion posts.
    """
    checkedDate: PartialDate
    """
    When we read the source.
    """


class MethodSiteRole(RootModel[Literal['read', 'write']]):
    root: Annotated[Literal['read', 'write'], Field(title='MethodSiteRole')]


class MethodSite(SpecModel):
    """
    One place in the subject model where an artifact reads or writes.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    address: Annotated[
        str | None,
        Field(
            max_length=200,
            pattern='^([a-z][a-z0-9_]*(\\.[0-9]+)?(\\.[a-z][a-z0-9_]*-[0-9]+)*|path\\.[A-Za-z0-9_.]+)$',
        ),
    ] = None
    """
    The interp-engine address of the point (`resid_post.12`, `resid_post.5.stream-2`). Left out when the source does not say which point it uses.
    """
    role: MethodSiteRole
    source: Annotated[str, Field(min_length=1)]
    """
    The name that the source uses (`blocks.12.hook_resid_post`, `layer 58`).
    """


class MethodArtifactFile(SpecModel):
    """
    One file of an artifact.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(max_length=200, pattern='^[A-Za-z0-9][A-Za-z0-9._-]*$')]
    """
    The file name (`l_48_lm_500000_ar_lr.pt`).
    """
    url: Url | None = None
    """
    The file at its source, at a fixed commit.
    """
    sha256: Sha256
    bytes: Annotated[int, Field(ge=0)]
    mirror: Annotated[
        str | None, Field(pattern='^artifacts/[0-9a-f]{64}/[A-Za-z0-9][A-Za-z0-9._-]*$')
    ] = None
    """
    The key of our copy in R2. `apps/web/scripts/mirror-artifact-files.ts` uploads the file and sets it.
    """


class MethodResult(SpecModel):
    """
    One number for one artifact on one eval version, as the source gives it.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    artifactId: Id
    evalVersionId: Id
    metric: Annotated[str, Field(min_length=1)]
    """
    A `MetricDef` key of the eval version.
    """
    value: float
    stderr: Annotated[float | None, Field(ge=0.0)] = None
    n: Annotated[int | None, Field(ge=1)] = None
    """
    The number of samples.
    """
    sourceUrl: Url
    """
    The result file or paper.
    """
    sourceTable: Annotated[str | None, Field(min_length=1)] = None
    """
    The table in the paper (`Table 9`).
    """
    sourceCommit: Annotated[str | None, Field(min_length=1)] = None
    """
    The commit of the eval code that made the number.
    """
    measuredAt: Timestamp | None = None


class ModelSource(RootModel[Literal['hf', 'api']]):
    root: Annotated[Literal['hf', 'api'], Field(title='ModelSource')]
    """
    `hf`: weights on the Hugging Face Hub (or `local/<name>`). `api`: a model behind a provider API. The name alone can collide (`openai/gpt-oss-20b` is open), so the source is part of the identity.
    """


class ParentRelation(RootModel[Literal['quantized', 'adapter', 'finetune']]):
    root: Annotated[
        Literal['quantized', 'adapter', 'finetune'], Field(title='ParentRelation')
    ]
    """
    How a model comes from its parent, as the Hub's `base_model:<relation>:` tags.
    """


class Modality(RootModel[Literal['text', 'image', 'audio', 'video']]):
    root: Annotated[Literal['text', 'image', 'audio', 'video'], Field(title='Modality')]


class Modalities(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    input: list[Modality]
    output: list[Modality]


class Tag(RootModel[str]):
    root: Annotated[str, Field(min_length=1, title='Tag')]


class FactSourceKind(
    RootModel[Literal['document', 'hf_config', 'provider_docs', 'url', 'manual']]
):
    root: Annotated[
        Literal['document', 'hf_config', 'provider_docs', 'url', 'manual'],
        Field(title='FactSourceKind'),
    ]


class LabPrefix(RootModel[str]):
    root: Annotated[str, Field(pattern='^[a-z0-9][a-z0-9-]*$', title='LabPrefix')]


class LadderModel(RootModel[str]):
    root: Annotated[
        str,
        Field(
            pattern='^[a-z0-9][a-z0-9-]*/[A-Za-z0-9][A-Za-z0-9._-]*$',
            title='LadderModel',
        ),
    ]
    """
    An OpenRouter model id (`anthropic/claude-sonnet-5.5`).
    """


class ModelTier(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    description: Annotated[str, Field(min_length=1)]
    models: Annotated[list[LadderModel], Field(min_length=1)]
    """
    Best first. At most one model per lab, so that each target gets a model.
    """


class LadderRole(SpecModel):
    """
    A job and its models. It has a `tier` or `models`, not both.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    description: Annotated[str, Field(min_length=1)]
    tier: Annotated[str | None, Field(min_length=1)] = None
    """
    The name of a tier in `tiers`.
    """
    models: Annotated[list[LadderModel] | None, Field(min_length=1)] = None
    """
    The role's own ladder, best first, in place of a tier.
    """


class SystemicRisk(
    RootModel[
        Literal['cbrn', 'cyber_offence', 'loss_of_control', 'harmful_manipulation']
    ]
):
    root: Annotated[
        Literal['cbrn', 'cyber_offence', 'loss_of_control', 'harmful_manipulation'],
        Field(title='SystemicRisk'),
    ]
    """
    A specified systemic risk of the EU General-Purpose AI Code of Practice, Safety and Security chapter, Appendix 1.4. `cbrn`: chemical, biological, radiological and nuclear. `cyber_offence`: large-scale cyber-attacks. `loss_of_control`: people can no longer direct, change or shut down the model. `harmful_manipulation`: strategic distortion of beliefs or behavior of many people or of high-stakes decision-makers.
    """


class VerdictLevel(
    RootModel[Literal['not_enough_evidence', 'no_evidence', 'low', 'moderate', 'high']]
):
    root: Annotated[
        Literal['not_enough_evidence', 'no_evidence', 'low', 'moderate', 'high'],
        Field(title='VerdictLevel'),
    ]
    """
    Our level for one risk, from our eval runs only. It is not the Code's risk tier and not a legal finding. `not_enough_evidence`: no eval run, or too few samples, covers the risk. `no_evidence`: the runs that cover the risk show no sign of it. `low`, `moderate`, `high`: the runs show signs of the risk, from small to strong.
    """


class CoverageLevel(RootModel[Literal['none', 'weak', 'some', 'good']]):
    root: Annotated[
        Literal['none', 'weak', 'some', 'good'], Field(title='CoverageLevel')
    ]
    """
    How well our runs cover a topic or a risk. `none`, `weak` (few samples or one narrow eval), `some`, `good`.
    """


class RiskVerdict(SpecModel):
    """
    Our verdict on one systemic risk. `evidence` is the runs it rests on; `missing` says what no run covers yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    risk: SystemicRisk
    level: VerdictLevel
    coverage: CoverageLevel
    summary: Annotated[str, Field(min_length=1)]
    """
    Markdown. What the evidence shows, and how strong it is.
    """
    runIds: list[Id]
    missing: Annotated[str, Field(min_length=1)]
    """
    The parts of the risk that no run covers.
    """


class TopicSummary(SpecModel):
    """
    What our runs show for one topic. `summary` is left out when no run covers it.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    topic: Topic
    coverage: CoverageLevel
    summary: Annotated[str | None, Field(min_length=1)] = None
    runIds: list[Id]


class CoverageGap(SpecModel):
    """
    A topic or a risk that our runs do not cover, or cover only weakly.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: Literal['topic', 'risk']
    key: Annotated[str, Field(min_length=1)]
    """
    A `Topic` or a `SystemicRisk`.
    """
    coverage: Literal['none', 'weak']
    text: Annotated[str, Field(min_length=1)]


class CardRun(SpecModel):
    """
    One run a version used, and its eval version.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    runId: Id
    evalVersionId: Id


class SnippetCategory(
    RootModel[
        Literal[
            'harmful_requests',
            'agentic_misuse',
            'bio_chem',
            'cyber',
            'child_safety',
            'self_harm',
            'toxicity',
            'prompt_injection',
            'honesty',
            'manipulation',
            'sycophancy',
            'hallucination',
            'bias',
            'sabotage',
            'power_seeking',
            'reward_hacking',
            'other',
        ]
    ]
):
    root: Annotated[
        Literal[
            'harmful_requests',
            'agentic_misuse',
            'bio_chem',
            'cyber',
            'child_safety',
            'self_harm',
            'toxicity',
            'prompt_injection',
            'honesty',
            'manipulation',
            'sycophancy',
            'hallucination',
            'bias',
            'sabotage',
            'power_seeking',
            'reward_hacking',
            'other',
        ],
        Field(title='SnippetCategory'),
    ]
    """
    The topic (an eval `Topic`) of the AI's act, or `other`. Topics about the test, not an act in one transcript, are not in the list.
    """


class SnippetSeverity(RootModel[Literal['low', 'medium', 'high', 'critical']]):
    root: Annotated[
        Literal['low', 'medium', 'high', 'critical'], Field(title='SnippetSeverity')
    ]
    """
    `critical`: only from older flaggers. `high`: the AI seems willing to let people be killed or badly hurt, by real help or by a deliberate act as an agent. `medium`: other harmful help or acts, or a lie, hallucination or bias on something that matters. `low`: a small problem.
    """


class SnippetMessage(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    index: Annotated[int, Field(ge=0)]
    """
    The message's place in the target's thread, from 0.
    """
    role: Literal['system', 'user', 'assistant', 'tool']
    text: str
    """
    The message text, cut when long.
    """


class SnippetExcerpt(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    messages: Annotated[list[SnippetMessage], Field(min_length=1)]
    quote: Annotated[str | None, Field(min_length=1)] = None
    """
    The exact words that show the problem. Left out when the flagger's quote is not in the transcript.
    """


class OpenAuditSnippet(SpecModel):
    """
    One case that the flagger model marked in one attempt of a run.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    runId: Id
    attemptId: Id
    category: SnippetCategory
    severity: SnippetSeverity
    title: Annotated[str | None, Field(min_length=1)] = None
    """
    The problem in 1 to 3 words, for example "Copyright violation". Older snippets have none.
    """
    reason: Annotated[str, Field(min_length=1)]
    """
    One or two sentences.
    """
    excerpt: SnippetExcerpt
    flagger: Annotated[str, Field(min_length=1)]
    promptVersion: Annotated[str, Field(min_length=1)]


class Markdown(RootModel[str]):
    root: Annotated[str, Field(min_length=1, title='Markdown')]
    """
    Markdown text. Raw HTML is not shown.
    """


class DatePrecision(RootModel[Literal['day', 'month', 'year']]):
    root: Annotated[Literal['day', 'month', 'year'], Field(title='DatePrecision')]
    """
    How exact the date next to it is. It agrees with the date's form (YYYY-MM-DD, YYYY-MM, YYYY).
    """


class OrgSource(SpecModel):
    """
    A public source for a fact.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    url: Url
    title: Annotated[str | None, Field(min_length=1)] = None
    """
    The headline or page title.
    """
    publisher: Annotated[str | None, Field(min_length=1)] = None
    """
    The outlet or site (`Reuters`).
    """
    date: PartialDate | None = None


class IncidentSeverity(RootModel[Literal['red', 'orange', 'yellow']]):
    root: Annotated[Literal['red', 'orange', 'yellow'], Field(title='IncidentSeverity')]
    """
    `red`: someone died, or many people were severely harmed, in credible reports or lawsuits. `orange`: a regulator or court action, a serious security breach, or credible reports of a significant safety failure or a broken safety commitment, with no death or severe harm to many people. `yellow`: concerning, but limited or disputed.
    """


class IncidentStatus(
    RootModel[
        Literal[
            'ongoing', 'resolved', 'disputed', 'under_investigation', 'in_litigation'
        ]
    ]
):
    root: Annotated[
        Literal[
            'ongoing', 'resolved', 'disputed', 'under_investigation', 'in_litigation'
        ],
        Field(title='IncidentStatus'),
    ]


class IncidentPrimaryCategory(
    RootModel[
        Literal[
            'model_hacking',
            'model_deception',
            'model_misbehavior',
            'suicide_and_delusion',
            'sexual_content_with_minors',
            'nonconsensual_images',
            'false_or_hateful_claims',
            'used_by_attackers',
            'safeguards_failed',
            'systems_breached',
            'data_exposed',
            'prompt_injection',
            'privacy_violation',
            'safety_related_cut',
        ]
    ]
):
    root: Annotated[
        Literal[
            'model_hacking',
            'model_deception',
            'model_misbehavior',
            'suicide_and_delusion',
            'sexual_content_with_minors',
            'nonconsensual_images',
            'false_or_hateful_claims',
            'used_by_attackers',
            'safeguards_failed',
            'systems_breached',
            'data_exposed',
            'prompt_injection',
            'privacy_violation',
            'safety_related_cut',
        ],
        Field(title='IncidentPrimaryCategory'),
    ]
    """
    What went wrong. `model_hacking`: a model broke into systems, took credentials or got out of its limits by itself. `model_deception`: a model lied, schemed or hid what it did. `model_misbehavior`: a model did other harmful things that nobody asked for. `suicide_and_delusion`: chats linked to suicide, self-harm or delusions. `sexual_content_with_minors`: sexual chats with minors, or child abuse images. `nonconsensual_images`: sexual or fake images of real people. `false_or_hateful_claims`: the model stated false information or hate. `used_by_attackers`: criminals or state actors used the model for attacks, targeting, influence operations or violence. `safeguards_failed`: the model gave dangerous help, or its safeguards were weak or off. `systems_breached`: attackers got into the organization's systems or accounts. `data_exposed`: the organization leaked user data, keys, code or weights. `prompt_injection`: a product flaw lets outside content control an agent. `privacy_violation`: the organization collected, used or uploaded data without clear consent. `safety_related_cut`: the organization dropped safety commitments, testing, reports, teams or staff.
    """


class IncidentCategory(
    RootModel[
        Literal[
            'security',
            'privacy',
            'misuse',
            'model_behavior',
            'deception',
            'safety_process',
            'governance',
            'legal',
            'child_safety',
            'mental_health',
            'misinformation',
            'bias',
            'copyright',
            'labor',
            'other',
        ]
    ]
):
    root: Annotated[
        Literal[
            'security',
            'privacy',
            'misuse',
            'model_behavior',
            'deception',
            'safety_process',
            'governance',
            'legal',
            'child_safety',
            'mental_health',
            'misinformation',
            'bias',
            'copyright',
            'labor',
            'other',
        ],
        Field(title='IncidentCategory'),
    ]


class IncidentLogRole(
    RootModel[
        Literal[
            'system',
            'user',
            'assistant',
            'reasoning',
            'tool_call',
            'tool_result',
            'note',
        ]
    ]
):
    root: Annotated[
        Literal[
            'system',
            'user',
            'assistant',
            'reasoning',
            'tool_call',
            'tool_result',
            'note',
        ],
        Field(title='IncidentLogRole'),
    ]
    """
    Who wrote a log step. `reasoning`: the model's thinking (chain of thought). `tool_call`: a command or tool call by the model. `tool_result`: what a tool or the environment returned. `note`: our short note between steps; it is not from the log.
    """


class IncidentLogStep(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    role: IncidentLogRole
    label: Annotated[str | None, Field(min_length=1)] = None
    """
    The source's label for the step (`Tool result — Slack message`).
    """
    text: Annotated[str, Field(min_length=1)]
    """
    As the source shows it. `[...]` marks text that the source cut, and `[name]` text that it replaced.
    """


class IncidentLog(SpecModel):
    """
    One excerpt of a log (a chat, chain of thought or tool calls) from a source, with the steps copied as the source shows them.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    title: Annotated[str, Field(min_length=1)]
    """
    A few words about the excerpt (`The model reads the Slack thread`).
    """
    description: Markdown
    """
    1 or 2 short sentences about what the excerpt shows.
    """
    source: OrgSource
    model: Annotated[str | None, Field(min_length=1)] = None
    """
    The model as the source names it.
    """
    ocr: bool | None = None
    """
    The steps are read from a screenshot.
    """
    steps: Annotated[list[IncidentLogStep], Field(min_length=1)]


class OrgIncident(SpecModel):
    """
    A significant AI safety, security or responsible-AI event that involves the organization or its models, with at least one safety category. Not copyright, scraping, likeness, labor, privacy-regulator, censorship, bias, sanction or corporate-governance matters. Its page is `/<organization slug>/incidents/<slug>`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    organizationId: Id
    slug: Slug
    """
    Unique in the organization (`2023-internal-forum-breach`).
    """
    title: Annotated[str, Field(min_length=1)]
    date: PartialDate
    """
    When the incident started.
    """
    datePrecision: DatePrecision
    endDate: PartialDate | None = None
    severity: IncidentSeverity
    status: IncidentStatus
    primaryCategory: IncidentPrimaryCategory
    """
    The one category that the feeds show.
    """
    categories: Annotated[list[IncidentCategory], Field(min_length=1)]
    """
    Tags.
    """
    summary: Markdown
    """
    1 or 2 sentences.
    """
    description: Markdown
    """
    2 or 3 short sentences, on the incident page.
    """
    modelIds: list[Id] | None = None
    """
    The models whose behavior is the incident: the model that did the unsafe act, that people misused, or whose weights leaked or safeguard failed. Any developer. Empty when no model's behavior is part of it. A model with no public name has a placeholder model (`openai/unreleased-hf-hack`, `xai/unknown-deepfakes`).
    """
    sources: Annotated[list[OrgSource], Field(min_length=1)]
    logs: list[IncidentLog] | None = None
    """
    Log excerpts that show the model's behavior, in source order.
    """


class OrgIncidentEvent(SpecModel):
    """
    One event in an incident's timeline.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    incidentId: Id
    order: Annotated[int, Field(ge=0)]
    """
    The place in the timeline, from 0. Events with the same date keep this order.
    """
    date: PartialDate
    datePrecision: DatePrecision
    title: Annotated[str, Field(min_length=1)]
    description: Markdown | None = None
    """
    One sentence.
    """
    sources: list[OrgSource]


class DepartureKind(RootModel[Literal['resigned', 'fired', 'laid_off', 'unclear']]):
    root: Annotated[
        Literal['resigned', 'fired', 'laid_off', 'unclear'],
        Field(title='DepartureKind'),
    ]


class Quote(SpecModel):
    """
    The person's own words, copied exactly from the source.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    text: Annotated[str, Field(min_length=1)]
    url: Url


class Image(SpecModel):
    """
    A freely licensed photo from Wikimedia Commons.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    url: Annotated[str, Field(pattern='^https://upload\\.wikimedia\\.org/')]
    pageUrl: Annotated[str, Field(pattern='^https://commons\\.wikimedia\\.org/')]
    """
    The Commons file page.
    """
    license: Annotated[str, Field(min_length=1)]
    author: Annotated[str, Field(min_length=1)]
    """
    The author as Commons states it.
    """


class OrgDeparture(SpecModel):
    """
    A person who left in 2023 or later over AI safety concerns at the organization, or a safety leader who left. Not ethics, copyright or personal reasons.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    organizationId: Id
    name: Annotated[str, Field(min_length=1)]
    """
    Unique in the organization.
    """
    title: Annotated[str | None, Field(min_length=1)] = None
    """
    The person's role at the organization.
    """
    departedDate: PartialDate | None = None
    datePrecision: DatePrecision | None = None
    kind: DepartureKind
    reason: Markdown | None = None
    quote: Quote | None = None
    """
    The person's own words, copied exactly from the source.
    """
    image: Image | None = None
    """
    A freely licensed photo from Wikimedia Commons.
    """
    website: Url | None = None
    """
    The person's own site.
    """
    nextRole: Markdown | None = None
    sources: Annotated[list[OrgSource], Field(min_length=1)]


class CardSource(SpecModel):
    """
    Where in the document a value is. The quote is the card's own words.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    page: Annotated[str | None, Field(min_length=1)] = None
    """
    The page or section (`12`, `5.3.2`), as printed in the document.
    """
    pdfPage: Annotated[int | None, Field(ge=1)] = None
    """
    The page in our saved PDF, from 1. Links go here; `page` is what we show.
    """
    quote: Annotated[str, Field(min_length=1)]


class Disclosure(SpecModel):
    """
    One model fact. `stated`: the card says it (give `value` and `source`). `not_stated`: we read the card; it does not say. Left out: not extracted yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    status: Literal['stated', 'not_stated']
    value: Annotated[str | None, Field(min_length=1)] = None
    """
    The value in the card's words (`200K tokens`, `March 2026`).
    """
    source: CardSource | None = None


class Disclosures(SpecModel):
    """
    The disclosure checklist. The keys match `ModelFacts`, plus training facts.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    releaseDate: Disclosure | None = None
    knowledgeCutoff: Disclosure | None = None
    contextWindow: Disclosure | None = None
    maxOutput: Disclosure | None = None
    modalities: Disclosure | None = None
    reasoningModes: Disclosure | None = None
    languages: Disclosure | None = None
    license: Disclosure | None = None
    totalParams: Disclosure | None = None
    activeParams: Disclosure | None = None
    architecture: Disclosure | None = None
    trainingData: Disclosure | None = None
    trainingCompute: Disclosure | None = None


class RiskDomain(
    RootModel[
        Literal[
            'bio_chem',
            'cyber',
            'ai_rnd_autonomy',
            'misalignment',
            'manipulation',
            'other',
        ]
    ]
):
    root: Annotated[
        Literal[
            'bio_chem',
            'cyber',
            'ai_rnd_autonomy',
            'misalignment',
            'manipulation',
            'other',
        ],
        Field(title='RiskDomain'),
    ]


class RiskLevel(RootModel[Literal['below', 'early_warning', 'reached', 'highest']]):
    root: Annotated[
        Literal['below', 'early_warning', 'reached', 'highest'],
        Field(title='RiskLevel'),
    ]
    """
    Our coarse level, for sorting only. Always show the lab's own label next to it. `below`: under the lab's first threshold. `early_warning`: an alert or watch level. `reached`: a threshold is reached or cannot be ruled out. `highest`: the top level.
    """


class FrameworkId(
    RootModel[
        Literal[
            'anthropic-rsp',
            'anthropic-fcf',
            'openai-preparedness',
            'google-fsf',
            'meta-aasf',
            'amazon-fmsf',
            'xai-faif',
            'xai-rmf',
            'seoul-commitments',
        ]
    ]
):
    root: Annotated[
        Literal[
            'anthropic-rsp',
            'anthropic-fcf',
            'openai-preparedness',
            'google-fsf',
            'meta-aasf',
            'amazon-fmsf',
            'xai-faif',
            'xai-rmf',
            'seoul-commitments',
        ],
        Field(title='FrameworkId'),
    ]
    """
    A published safety framework. `anthropic-rsp`: Responsible Scaling Policy (also ASL levels). `anthropic-fcf`: Frontier Compliance Framework. `openai-preparedness`: Preparedness Framework. `google-fsf`: Frontier Safety Framework. `meta-aasf`: Advanced AI Scaling Framework. `amazon-fmsf`: Frontier Model Safety Framework. `xai-faif`: Frontier Artificial Intelligence Framework. `xai-rmf`: Risk Management Framework. `seoul-commitments`: Frontier AI Safety Commitments (Seoul, 2024).
    """


class MitigationPhase(
    RootModel[Literal['before_mitigation', 'after_mitigation', 'unspecified']]
):
    root: Annotated[
        Literal['before_mitigation', 'after_mitigation', 'unspecified'],
        Field(title='MitigationPhase'),
    ]


class RiskDecision(SpecModel):
    """
    One risk decision the lab states for one domain.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    domain: RiskDomain
    frameworks: Annotated[list[FrameworkId] | None, Field(min_length=1)] = None
    """
    The published frameworks the verdict is made under. Leave out if none is named.
    """
    labLabel: Annotated[str, Field(min_length=1)]
    """
    The lab's words (`ASL-3`, `High`, `CCL not reached`).
    """
    level: RiskLevel | None = None
    phase: MitigationPhase
    decidedBy: Annotated[str | None, Field(min_length=1)] = None
    """
    Who decided, when the card says (`Responsible Scaling Officer`).
    """
    modelIds: Annotated[list[Id] | None, Field(min_length=1)] = None
    """
    The covered models the verdict is about. Left out when it is about all of them.
    """
    source: CardSource


class TopicCoverage(SpecModel):
    """
    Does the card cover a topic. `covered`: give a source, and a headline number when there is one. Not covered: the card has nothing on it. Left out: not extracted yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    topic: Topic
    covered: bool
    headline: Annotated[str | None, Field(min_length=1)] = None
    """
    The main result in the card's words (`0.8% jailbreak success`).
    """
    source: CardSource | None = None


class ExternalTester(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    name: Annotated[str, Field(min_length=1)]
    """
    The tester (`METR`, `UK AISI`, `Apollo Research`).
    """
    scope: Annotated[str | None, Field(min_length=1)] = None
    """
    What they tested (`autonomy and AI R&D`).
    """
    source: CardSource


class FindingTone(RootModel[Literal['good', 'mixed', 'bad', 'neutral']]):
    root: Annotated[
        Literal['good', 'mixed', 'bad', 'neutral'], Field(title='FindingTone')
    ]
    """
    Our reading for a safety reader. `good`: good for safety. `mixed`: mixed, a mild concern or an important caveat. `bad`: a clear concern. `neutral`: a fact or method note.
    """


class ExtractionInfo(SpecModel):
    """
    How a record was made. `by` is the model or person.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    by: Annotated[str, Field(min_length=1)]
    at: Timestamp


class CardCover1(SpecModel):
    """
    A model the card covers. `rawModelName` when the model is not in our list yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    modelId: Any
    rawModelName: Annotated[str | None, Field(min_length=1)] = None
    section: Annotated[str | None, Field(min_length=1)] = None
    """
    The section about it, for cards that cover several models (`Appendix B`).
    """


class CardCover2(SpecModel):
    """
    A model the card covers. `rawModelName` when the model is not in our list yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    modelId: Id | None = None
    rawModelName: Any
    section: Annotated[str | None, Field(min_length=1)] = None
    """
    The section about it, for cards that cover several models (`Appendix B`).
    """


class CardCover(RootModel[CardCover1 | CardCover2]):
    root: Annotated[CardCover1 | CardCover2, Field(title='CardCover')]
    """
    A model the card covers. `rawModelName` when the model is not in our list yet.
    """


class ReasoningKind(RootModel[Literal['raw', 'summary', 'omitted', 'redacted']]):
    root: Annotated[
        Literal['raw', 'summary', 'omitted', 'redacted'], Field(title='ReasoningKind')
    ]
    """
    `raw`: the model's own thinking (open models). `summary`: the provider's summary. `omitted`: the provider gave none. `redacted`: the provider hid it.
    """


class TextPart(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['text']
    text: str


class ReasoningPart(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['reasoning']
    kind: ReasoningKind
    text: str | None = None
    signature: str | None = None
    """
    The provider's opaque blob, kept so the transcript can continue there.
    """


class OtherPart(SpecModel):
    """
    A part we do not show yet (an image, audio); the original log keeps it.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    type: Literal['other']
    kind: Annotated[str, Field(min_length=1)]


class ContentPart(RootModel[TextPart | ReasoningPart | OtherPart]):
    root: Annotated[TextPart | ReasoningPart | OtherPart, Field(title='ContentPart')]


class ToolCall(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(min_length=1)]
    function: Annotated[str, Field(min_length=1)]
    arguments: dict[str, Any] | None = None


class Message(SpecModel):
    """
    One chat message. A superset of Inspect's and OpenAI's shape.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(min_length=1)]
    """
    Stable, so notes and links survive import and export.
    """
    role: Literal['system', 'user', 'assistant', 'tool']
    content: list[ContentPart]
    toolCalls: list[ToolCall] | None = None
    toolCallId: Annotated[str | None, Field(min_length=1)] = None
    """
    For a `tool` message, the call it answers.
    """
    model: Annotated[str | None, Field(min_length=1)] = None
    """
    For an `assistant` message, the model that wrote it.
    """


class Participant(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(min_length=1)]
    role: ModelRole
    modelId: Id | None = None
    name: Annotated[str | None, Field(min_length=1)] = None
    """
    The model or person as the source names it.
    """


class Thread(SpecModel):
    """
    One participant's ordered view of the conversation.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(min_length=1)]
    participant: Annotated[str, Field(min_length=1)]
    """
    A `Participant.id`.
    """
    messages: list[Message]


class Transcript(SpecModel):
    """
    The messages of one attempt or chat. Scores stay on the attempt. `extensions` keeps source fields we do not map (`extensions.inspect`).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    participants: Annotated[list[Participant], Field(min_length=1)]
    threads: Annotated[list[Thread], Field(min_length=1)]
    extensions: dict[str, Any] | None = None


class CommitmentCriterion(SpecModel):
    """
    One part of the ideal form of a commitment.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Slug
    """
    Unique in the commitment (`deep-access`).
    """
    label: Annotated[str, Field(min_length=1)]
    """
    A few words in Title Case (`Deep Access`).
    """
    description: Markdown
    """
    One sentence that tells what meets the criterion.
    """


class Commitment(SpecModel):
    """
    One kind of safety commitment, with the criteria of its ideal form. Its page is `/organizations/commitments/<slug>`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    name: Annotated[str, Field(min_length=1)]
    """
    Title Case (`Embedded Evaluators`).
    """
    category: CommitmentCategory
    order: Annotated[int, Field(ge=0)]
    """
    The place of the column in the table.
    """
    summary: Markdown
    """
    One sentence that tells the ideal form.
    """
    description: Markdown
    """
    Why it matters for safety, in 2 or 3 short sentences.
    """
    criteria: Annotated[list[CommitmentCriterion], Field(min_length=1)]


class CommitmentState(SpecModel):
    """
    An organization's commitment at one time.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    level: CommitmentLevel
    strength: CommitmentStrength | None = None
    duration: CommitmentDuration | None = None
    endDate: PartialDate | None = None
    """
    When a time-limited commitment ends.
    """
    condition: Annotated[str | None, Field(min_length=1)] = None
    """
    The condition that the commitment depends on, in a few words (`If all frontier labs agree`). Empty when it has no condition.
    """
    criteria: dict[Slug, CriterionStatus]
    """
    Each criterion of the commitment by its key. A criterion that is not here is not known.
    """
    verified: list[Slug] | None = None
    """
    The keys of the met or partly met criteria that an independent party can check, with a public result. Missing is none.
    """
    notes: dict[Slug, CriterionNote] | None = None
    """
    Where the organization is now on each criterion, by its key.
    """
    limits: list[Limit]
    """
    The exceptions and limits, each in a few words (`Lab can redact`).
    """


class CommitmentQuote(SpecModel):
    """
    The organization's own words, copied exactly from the source.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    text: Annotated[str, Field(min_length=1)]
    url: Url


class OrgCommitment(SpecModel):
    """
    One organization's current state for one commitment: the state after its newest event, or `none_found` with no events. Its page is `/<organization slug>/commitments/<commitment slug>`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    organizationId: Id
    commitmentId: Id
    checkedAt: date_aliased
    """
    The day of the newest research (YYYY-MM-DD).
    """
    checkedBy: Annotated[str | None, Field(min_length=1)] = None
    """
    The model that did the newest research, with its effort, as "Claude Opus 5.5 (High)".
    """
    summary: Markdown | None = None
    """
    The current state in one sentence, for the table and the lists.
    """
    state: CommitmentState


class OrgCommitmentEvent(SpecModel):
    """
    One event in an organization's commitment timeline, with the state after it.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    orgCommitmentId: Id
    order: Annotated[int, Field(ge=0)]
    """
    The place in the timeline, from 0, oldest first.
    """
    date: PartialDate
    datePrecision: DatePrecision
    kind: CommitmentEventKind
    title: Annotated[str, Field(min_length=1)]
    """
    A short headline (`Signs agreements with four embedded assessors`).
    """
    summary: Markdown | None = None
    """
    1 or 2 short sentences.
    """
    quote: CommitmentQuote | None = None
    agreement: Annotated[str | None, Field(min_length=1)] = None
    """
    The shared agreement that the event is part of (`Frontier AI Safety Commitments`).
    """
    sources: Annotated[list[OrgSource], Field(min_length=1)]
    state: CommitmentState


class EvalSuite(SpecModel):
    """
    A set of evals that one source publishes together (SAEBench). Its page compares method variants across its evals. An eval names its suite with `suiteId`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    """
    The name in URLs (`saebench`).
    """
    displayName: Annotated[str, Field(min_length=1)]
    summary: Annotated[str, Field(max_length=200, min_length=1)]
    """
    One plain sentence about what the suite tests.
    """
    description: Annotated[str | None, Field(min_length=1)] = None
    """
    A short Markdown description.
    """
    maintainers: list[EvalMaintainer]
    links: list[EvalLink]
    evalOrder: list[Slug] | None = None
    """
    Slugs of its evals in display order, safety tasks first. Its other evals follow, safety tasks first, then by name.
    """
    matched: MethodMatch | None = None
    """
    Compare method variants at set values of one metric of a suite eval. Without it, each variant uses its one artifact in a group.
    """


class EvalDataset(SpecModel):
    """
    Where the samples come from. Give `hfRepo` and `revision`, or `url`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    hfRepo: Annotated[str | None, Field(pattern='^[^/\\s]+/[^/\\s]+$')] = None
    """
    A Hugging Face dataset repo (`cais/MASK`).
    """
    revision: Annotated[str | None, Field(min_length=1)] = None
    """
    The commit or tag the samples come from.
    """
    url: Url | None = None
    sha256: Sha256 | None = None
    """
    The hash of all samples in order, as the spec serializes them.
    """
    license: Annotated[str | None, Field(min_length=1)] = None
    """
    An SPDX id when there is one (`cc-by-4.0`), else the license name.
    """
    sources: list[DatasetSource] | None = None
    """
    More data the task loads, for suites that join datasets (AbstentionBench).
    """
    splits: Annotated[list[EvalSplit], Field(min_length=1)]


class ScoreDef(SpecModel):
    """
    One score a scorer gives each attempt (Petri's judge gives about 36).
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    key: Annotated[str, Field(pattern='^[a-z][a-z0-9_]*$')]
    """
    The name in data (`unprompted_deception`).
    """
    attemptName: Annotated[str | None, Field(min_length=1)] = None
    """
    The name of this score on an attempt when it is not `key` or ends with `/<key>`, such as the scorer's name (`fortress_scorer_adversarial`).
    """
    attemptScale: Annotated[float | None, Field(gt=0.0)] = None
    """
    The factor that puts an attempt's value on this score's scale (100 for a 0 to 1 value of a percent).
    """
    displayName: Annotated[str, Field(min_length=1)]
    type: ScoreType
    min: float | None = None
    max: float | None = None
    direction: Direction
    description: Annotated[str | None, Field(min_length=1)] = None
    """
    What the score means; for a judge, a summary of its rubric.
    """
    pass_: Annotated[PassRule | None, Field(alias='pass')] = None


class ModelSlot(SpecModel):
    """
    One model a task needs besides the target. The runner gives it as `taskArg` or as `inspectRole`; give one. A run can change it; a re-score can change it only when `scoring`.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Annotated[str, Field(pattern='^[a-z][a-z0-9_]*$')]
    """
    Unique in the version (`judge`, `refusal_judge`, `mark`).
    """
    role: ModelRole
    label: Annotated[str | None, Field(min_length=1)] = None
    """
    The name to show (`Refusal judge`). Default from `id`.
    """
    taskArg: Annotated[str | None, Field(min_length=1)] = None
    """
    Give the model as this task argument (`scorer_model`).
    """
    index: Annotated[int | None, Field(ge=0)] = None
    """
    The place in a list task argument (`grader_models`).
    """
    inspectRole: Annotated[str | None, Field(min_length=1)] = None
    """
    Give the model as this Inspect model role (`grader`).
    """
    default: Annotated[str, Field(min_length=1)]
    """
    The model the task uses when not told, as a route model id (`openai/gpt-4o`). With a `tier`, our runs use the tier and this is only a record of the task's default.
    """
    tier: Annotated[str | None, Field(min_length=1)] = None
    """
    The lowest tier in spec/model-ladders.yaml that is good enough for this slot. A run gets the first model of the tier that the rules allow, and the next ones as fallbacks. A model of a higher tier is also good enough.
    """
    labs: Annotated[list[LabPrefix] | None, Field(min_length=1)] = None
    """
    Use these labs' models of the tier first, in this order, when the rules allow it.
    """
    sameLab: bool | None = None
    """
    The slot can use a model of the target's lab (one judge in a panel of judges from several labs). It never uses the target model itself.
    """
    scoring: bool | None = None
    """
    Only the scorer uses it, so a re-score can change it.
    """


class EvalRunner(SpecModel):
    """
    How to run a version. Optional; a run can come from anywhere.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: RunnerKind
    task: Annotated[str | None, Field(min_length=1)] = None
    """
    The task to run (`inspect_evals/mask`, `inspect_petri/audit`).
    """
    package: Annotated[str | None, Field(min_length=1)] = None
    """
    The package and version that has the task (`inspect-evals==0.9.2`).
    """
    dependencies: list[Dependency] | None = None
    """
    Other packages the task uses, each with its version (`inspect-petri==3.1.0`).
    """
    roles: list[ModelRole] | None = None
    """
    The model roles a run must fill.
    """
    models: list[ModelSlot] | None = None
    """
    The models besides the target, and how the task gets each one.
    """
    targetRole: Annotated[str | None, Field(min_length=1)] = None
    """
    Also give the target as this Inspect model role (`target`), for tasks that read it by role.
    """
    sandbox: Annotated[str | None, Field(min_length=1)] = None
    """
    The sandbox the task needs (`docker`), if any.
    """
    internet: bool | None = None
    gpu: bool | None = None
    """
    The runner needs a GPU (white-box methods).
    """
    rawReasoning: bool | None = None
    """
    The scores need the model's raw chain of thought. Most provider APIs do not return it, so we do not offer the eval for API models.
    """
    defaultTrials: Annotated[int | None, Field(ge=1)] = None
    defaultLimit: Annotated[int | None, Field(ge=1)] = None
    """
    The samples a run does when its settings give no limit. A run with this limit or more counts as a full run.
    """


class EvalVersion(SpecModel):
    """
    One fixed form of an eval: its samples and how they are scored. Results from different versions are not comparable. A new version when the samples, scores, rubric or task defaults change. Judge and auditor models are run settings. A package release that changes none of these only changes the `runner` pins; each run keeps its package versions.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    evalId: Id
    version: Annotated[
        str, Field(max_length=40, pattern='^[A-Za-z0-9][A-Za-z0-9._-]*$')
    ]
    """
    The maintainer's name for it (`2.0`, `2026-02`). Unique per eval.
    """
    status: EvalVersionStatus
    releasedDate: PartialDate | None = None
    changes: Annotated[str | None, Field(min_length=1)] = None
    """
    What changed from the version before, in Markdown.
    """
    dataset: EvalDataset | None = None
    """
    Left out for `lab_internal` evals.
    """
    sampleTerms: SampleTerms | None = None
    scores: list[ScoreDef]
    metrics: list[MetricDef]
    runner: EvalRunner | None = None
    methodSetup: MethodEvalSetup | None = None
    """
    Only for evals whose subjects are methods.
    """


class EvalResult3(SpecModel):
    """
    One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    origin: ResultOrigin
    evalId: Id | None = None
    evalVersionId: Id | None = None
    rawEvalName: Annotated[str | None, Field(min_length=1)] = None
    """
    The eval's name as the source writes it (`SWE-bench Verified (n=500)`).
    """
    modelId: Id | None = None
    rawModelName: Annotated[str | None, Field(min_length=1)] = None
    """
    The model's name as the source writes it.
    """
    metric: Annotated[str, Field(min_length=1)]
    """
    A `MetricDef.key` when the version is known; else the source's words.
    """
    value: float
    unit: (
        Literal['fraction', 'percent', 'score', 'count', 'seconds', 'tokens', 'other']
        | None
    ) = None
    """
    `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
    """
    stderr: Annotated[float | None, Field(ge=0.0)] = None
    ciLow: float | None = None
    ciHigh: float | None = None
    n: Annotated[int | None, Field(ge=1)] = None
    """
    The number of samples, when stated.
    """
    safetyDirection: Direction | None = None
    """
    Which way is better for safety. `neither` for skill results (dangerous skills too) and for refusals of safe requests. Left out: not known.
    """
    capabilityDirection: Direction | None = None
    """
    Which way shows more skill. `neither` for behavior results. Left out: not known.
    """
    settings: ResultSettings
    source: ResultSource | None = None
    evalRunId: Id | None = None
    """
    The run a `measured` result comes from.
    """
    reviewed: bool
    extraction: ExtractionInfo | None = None


class EvalResult4(EvalResult1, EvalResult3):
    """
    One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    origin: ResultOrigin
    evalId: Id | None = None
    evalVersionId: Id | None = None
    rawEvalName: Annotated[str | None, Field(min_length=1)] = None
    """
    The eval's name as the source writes it (`SWE-bench Verified (n=500)`).
    """
    modelId: Id
    rawModelName: Annotated[str | None, Field(min_length=1)] = None
    """
    The model's name as the source writes it.
    """
    metric: Annotated[str, Field(min_length=1)]
    """
    A `MetricDef.key` when the version is known; else the source's words.
    """
    value: float
    unit: (
        Literal['fraction', 'percent', 'score', 'count', 'seconds', 'tokens', 'other']
        | None
    ) = None
    """
    `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
    """
    stderr: Annotated[float | None, Field(ge=0.0)] = None
    ciLow: float | None = None
    ciHigh: float | None = None
    n: Annotated[int | None, Field(ge=1)] = None
    """
    The number of samples, when stated.
    """
    safetyDirection: Direction | None = None
    """
    Which way is better for safety. `neither` for skill results (dangerous skills too) and for refusals of safe requests. Left out: not known.
    """
    capabilityDirection: Direction | None = None
    """
    Which way shows more skill. `neither` for behavior results. Left out: not known.
    """
    settings: ResultSettings
    source: ResultSource | None = None
    evalRunId: Id | None = None
    """
    The run a `measured` result comes from.
    """
    reviewed: bool
    extraction: ExtractionInfo | None = None


class EvalResult5(EvalResult2, EvalResult3):
    """
    One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    origin: ResultOrigin
    evalId: Id | None = None
    evalVersionId: Id | None = None
    rawEvalName: Annotated[str | None, Field(min_length=1)] = None
    """
    The eval's name as the source writes it (`SWE-bench Verified (n=500)`).
    """
    modelId: Id | None = None
    rawModelName: Annotated[str, Field(min_length=1)]
    """
    The model's name as the source writes it.
    """
    metric: Annotated[str, Field(min_length=1)]
    """
    A `MetricDef.key` when the version is known; else the source's words.
    """
    value: float
    unit: (
        Literal['fraction', 'percent', 'score', 'count', 'seconds', 'tokens', 'other']
        | None
    ) = None
    """
    `percent` is 0-100 and `fraction` is 0-1. `score` is any other scale.
    """
    stderr: Annotated[float | None, Field(ge=0.0)] = None
    ciLow: float | None = None
    ciHigh: float | None = None
    n: Annotated[int | None, Field(ge=1)] = None
    """
    The number of samples, when stated.
    """
    safetyDirection: Direction | None = None
    """
    Which way is better for safety. `neither` for skill results (dangerous skills too) and for refusals of safe requests. Left out: not known.
    """
    capabilityDirection: Direction | None = None
    """
    Which way shows more skill. `neither` for behavior results. Left out: not known.
    """
    settings: ResultSettings
    source: ResultSource | None = None
    evalRunId: Id | None = None
    """
    The run a `measured` result comes from.
    """
    reviewed: bool
    extraction: ExtractionInfo | None = None


class EvalResult(RootModel[EvalResult4 | EvalResult5]):
    """
    One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
    """

    root: Annotated[EvalResult4 | EvalResult5, Field(title='EvalResult')]
    """
    One number: one metric of one eval for one model. A reported result that matches no `Eval` or `Model` yet keeps the raw name, and the id is added later.
    """


class RunProvenance(SpecModel):
    """
    Where and how the run happened.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    tool: Annotated[str | None, Field(min_length=1)] = None
    """
    The program that ran the eval (`inspect_ai`).
    """
    toolVersion: Annotated[str | None, Field(min_length=1)] = None
    packages: dict[str, str] | None = None
    """
    Package versions, as the log states them (`{"inspect_evals": "0.22.0"}`).
    """
    task: Annotated[str | None, Field(min_length=1)] = None
    """
    The task as the log names it (`inspect_evals/truthfulqa`).
    """
    taskArgs: dict[str, Any] | None = None
    logModel: Annotated[str | None, Field(min_length=1)] = None
    """
    The model as the log names it (`openrouter/qwen/qwen3.6-27b`).
    """
    servedBy: list[ServedByItem] | None = None
    """
    The providers that served the model calls, as the route reported them.
    """
    host: Annotated[str | None, Field(min_length=1)] = None
    """
    The machine the runner ran on.
    """
    runnerVersion: Annotated[str | None, Field(min_length=1)] = None
    startedAt: Timestamp | None = None
    finishedAt: Timestamp | None = None
    tokens: TokenUsage | None = None
    costUsd: Annotated[float | None, Field(ge=0.0)] = None
    """
    What this run paid, when the routes say. A re-score pays only its judges.
    """
    note: Annotated[str | None, Field(min_length=1)] = None
    """
    What a reader must know about an imported run, from the log (`eval.metadata.note`). The run and attempt pages show it.
    """
    byModel: dict[str, ModelUsage] | None = None
    """
    Tokens and cost for each model, by the name in the log.
    """
    byRole: dict[str, ModelUsage] | None = None
    """
    Tokens and cost for each model role (`target`, `auditor`, `judge`, `judge_2`). A re-score has only its judges.
    """
    erroredSamples: Annotated[int | None, Field(ge=0)] = None
    """
    Samples with an error and no score. The results leave them out.
    """
    fallbacks: list[FallbackUse] | None = None
    """
    The calls that a slot's fallback models made in place of its model.
    """
    blocks: list[ProviderBlock] | None = None
    """
    Model calls that a provider refused for its policy, by provider. A run that failed or was cancelled because of a block also has them.
    """


class EvalRun(SpecModel):
    """
    One run of an eval version on one model, with its settings and provenance. `measured` results and attempts point to it.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    evalId: Id
    evalVersionId: Id
    modelId: Id
    origin: RunOrigin
    sourceRunId: Id | None = None
    """
    For a re-score, the run whose outputs it scores.
    """
    status: RunStatus
    route: ServingRoute
    settings: RunSettings
    provenance: RunProvenance | None = None
    log: FileRef | None = None
    """
    The original log (an Inspect `.eval`).
    """
    sampleCount: Annotated[int | None, Field(ge=0)] = None
    """
    The samples the run plans to do.
    """
    attemptCount: Annotated[int | None, Field(ge=0)] = None
    """
    The attempts done so far.
    """
    error: Annotated[str | None, Field(min_length=1)] = None
    visibility: Visibility
    createdAt: Timestamp


class MethodVariant(SpecModel):
    """
    One recipe or architecture of a method (TopK SAE, Apollo probe). A `baseline` is a simple reference that a variant must beat (raw activations, PCA). A changed recipe is a new variant, with `supersedesId` set to the old one.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    """
    Unique in its method.
    """
    methodId: Id
    displayName: Annotated[str, Field(min_length=1)]
    """
    Title case (`Apollo Probe`, `Chain-of-Thought Judge`).
    """
    aliases: Aliases
    """
    Names in result files (`MatryoshkaBatchTopK`, `matryoshka_batch_topk`).
    """
    summary: Annotated[str | None, Field(min_length=1)] = None
    access: MethodAccess
    baseline: bool
    componentIds: list[Id]
    """
    The variants that this one combines (a probe that reads SAE latents).
    """
    supersedesId: Id | None = None
    """
    The variant that this one replaces.
    """
    params: list[MethodParam]
    """
    Settings of this variant only, added to those of its method.
    """
    links: list[EvalLink]
    prompts: list[MethodPrompt] | None = None
    """
    The prompts of a variant that is an LLM, as the judge prompt of a monitor.
    """
    visibility: Visibility | None = None
    """
    Left out, `public`. Anyone with the link can open an unlisted variant.
    """


class MethodArtifact(SpecModel):
    """
    One trained SAE or probe, or one monitor setup, for one subject model. Evals score artifacts, not variants.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    key: Annotated[str, Field(max_length=200, pattern='^[a-z0-9]+([._/-][a-z0-9]+)*$')]
    """
    A stable key from the source (`gemma-2-2b/l12/w16k/topk/trainer-2`).
    """
    variantId: Id
    displayName: Annotated[str, Field(min_length=1)]
    subject: Annotated[str, Field(min_length=1)]
    """
    The model that the artifact inspects, as its Hub name (`google/gemma-2-2b`), or the name of a synthetic model.
    """
    modelId: Id | None = None
    """
    The `Model`, when the subject is in the catalog.
    """
    revision: Annotated[str | None, Field(min_length=1)] = None
    """
    The Hub revision of the subject.
    """
    sites: list[MethodSite]
    """
    Empty for a variant that does not use activations.
    """
    params: dict[str, str | float | bool]
    """
    Values for the `MethodParam` keys of the method and variant.
    """
    license: Annotated[str | None, Field(min_length=1)] = None
    sourceUrl: Url | None = None
    """
    Where to get the weights or the setup.
    """
    files: list[MethodArtifactFile] | None = None
    """
    The files to download, as the weights of a probe. Each has a `url`, a `mirror`, or both.
    """


class FactSource(SpecModel):
    """
    Where a fact comes from.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    kind: FactSourceKind
    """
    `document`: a `Document` (give `documentId`, and `page` and `quote` when you can). `hf_config`: the model's Hub config. `provider_docs` and `url`: a web page (give `url`). `manual`: entered by a person without a source to cite.
    """
    documentId: Id | None = None
    url: Url | None = None
    page: Annotated[str | None, Field(min_length=1)] = None
    """
    The page or section (`12`, `A.3`).
    """
    quote: Annotated[str | None, Field(min_length=1)] = None


class DateFact(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    value: PartialDate
    source: FactSource


class CountFact(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    value: Annotated[int, Field(ge=0)]
    source: FactSource


class TextFact(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    value: Annotated[str, Field(min_length=1)]
    source: FactSource


class TagsFact(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    value: list[Tag]
    source: FactSource


class ModalitiesFact(SpecModel):
    model_config = ConfigDict(
        extra='forbid',
    )
    value: Modalities
    source: FactSource


class ModelLadders(SpecModel):
    """
    The default models for the LLM jobs that OpenAudit runs itself, from spec/model-ladders.yaml. A tier is a ladder of models of about the same quality and price from different labs, best first. A role uses a tier or its own list. For a target model, a role skips the models of the target's lab.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    labs: dict[str, LabPrefix]
    """
    Other name prefixes of a lab, to the prefix that the ladders use (`meta-llama` to `meta`).
    """
    tiers: dict[str, ModelTier]
    roles: dict[str, LadderRole]
    openWeights: list[LadderModel] | None = None
    """
    The models in the ladders that have open weights.
    """


class CardFinding(SpecModel):
    """
    One notable finding, in Markdown. It names the runs (and snippets) it rests on.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    text: Annotated[str, Field(min_length=1)]
    tone: FindingTone
    runIds: Annotated[list[Id], Field(min_length=1)]
    snippetIds: list[Id] | None = None


class OpenAuditCardVersion(SpecModel):
    """
    One version of a model's OpenAudit Card: our summary from our own eval runs only. An LLM (`aggregator`) writes it from the runs' results and the flagged snippets.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    modelId: Id
    number: Annotated[int, Field(ge=1)]
    aggregator: Annotated[str, Field(min_length=1)]
    """
    The model that wrote it (`anthropic/claude-sonnet-5.5`).
    """
    promptVersion: Annotated[str, Field(min_length=1)]
    costUsd: Annotated[float, Field(ge=0.0)]
    createdAt: Timestamp
    runs: list[CardRun]
    snippetIds: list[Id]
    findings: list[CardFinding]
    verdicts: list[RiskVerdict]
    topics: list[TopicSummary]
    gaps: list[CoverageGap]


class Organization(SpecModel):
    """
    A lab or company that makes models or publishes documents.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    slug: Slug
    """
    The organization's page URL (`/qwen`, `/google`): the model owner that most of its models use, in lowercase. Unique. Also a reserved handle.
    """
    displayName: Annotated[str, Field(min_length=1)]
    """
    The name to show (`Alibaba`).
    """
    aliases: Aliases
    """
    Other names in documents (`Google DeepMind` and `Google Research` for `google`).
    """
    slugAliases: list[Slug]
    """
    Other slugs that redirect to `slug`: old slugs and other model owners (`alibaba` for `qwen`). Unique across all organizations.
    """
    website: Url | None = None
    """
    The organization's own website.
    """
    summary: Markdown | None = None
    """
    1 to 3 sentences about the organization, with inline source links.
    """
    researchedAt: date_aliased | None = None
    """
    The day of the newest research for the organization page (YYYY-MM-DD). New research looks only for events after this day.
    """
    researchDepth: Literal['deep', 'light'] | None = None
    """
    How wide the research was. `deep`: many searches and primary sources. `light`: a few searches; empty lists are usual.
    """


class Finding(SpecModel):
    """
    A notable finding that fits nowhere else. Short, in our words, with the quote.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    text: Annotated[str, Field(min_length=1)]
    tone: FindingTone | None = None
    source: CardSource


class SystemCard(SpecModel):
    """
    What we extracted from one card. One card can have several documents (the PDF, the web page, the blog post); `documentId` is the one we read.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    documentId: Id
    alsoDocumentIds: list[Id]
    """
    Other documents of the same card.
    """
    covers: list[CardCover]
    basedOnDocumentId: Id | None = None
    """
    The card this one updates (a delta card).
    """
    pageCount: Annotated[int | None, Field(ge=1)] = None
    disclosures: Disclosures
    riskDecisions: list[RiskDecision]
    topics: list[TopicCoverage]
    testers: list[ExternalTester]
    findings: list[Finding]
    reviewed: bool
    """
    A person checked it. Pages mark unreviewed values "Not reviewed".
    """
    extraction: ExtractionInfo


class ModelFacts(SpecModel):
    """
    Facts about a model. A fact is left out when nobody has found it yet.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    releaseDate: DateFact | None = None
    knowledgeCutoff: DateFact | None = None
    contextWindow: CountFact | None = None
    """
    Tokens.
    """
    maxOutput: CountFact | None = None
    """
    Tokens.
    """
    modalities: ModalitiesFact | None = None
    reasoningModes: TagsFact | None = None
    """
    The reasoning settings the model has (`none`, `low`, `high`).
    """
    languages: TagsFact | None = None
    """
    BCP 47 language tags (`en`, `zh`).
    """
    license: TextFact | None = None
    """
    An SPDX id when there is one (`apache-2.0`), else the license name.
    """
    totalParams: CountFact | None = None
    activeParams: CountFact | None = None
    """
    Parameters used per token. Less than `totalParams` for a mixture of experts.
    """
    architecture: TextFact | None = None
    """
    A short description (`MoE transformer, 256 experts`).
    """


class Model(SpecModel):
    """
    One model. Its facts are here, each with a source; a document is one source.
    """

    model_config = ConfigDict(
        extra='forbid',
    )
    id: Id
    source: ModelSource
    name: Annotated[str, Field(pattern='^[^/\\s]+/[^/\\s]+$')]
    """
    The HF repo id or `local/<name>` for `hf`; `provider/model` for `api`. Unique with `source`. Also the URL path.
    """
    displayName: Annotated[str, Field(min_length=1)]
    organizationId: Id
    """
    The `Organization` that made the model.
    """
    family: Annotated[str | None, Field(min_length=1)] = None
    """
    The model family, for grouping (`Llama 3`).
    """
    revision: Annotated[str | None, Field(min_length=1)] = None
    """
    The HF commit or the API snapshot id that the facts refer to.
    """
    aliases: Aliases
    """
    Other names, such as API ids (`davinci`) and old names.
    """
    parentId: Id | None = None
    """
    The model this one comes from. One parent; a chain for combinations.
    """
    parentRelation: ParentRelation | None = None
    removedFromHub: bool | None = None
    """
    The Hub repo was removed or made private. We keep the record.
    """
    pretrained: bool | None = None
    """
    A base model: pretrained only, with no instruct or chat tuning. Lists do not show it.
    """
    facts: ModelFacts
    documentIds: list[Id]
    """
    The `Document`s about this model. The order has no meaning.
    """


class SpecRecord(
    RootModel[
        Organization
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
        | MethodResult
    ]
):
    root: Annotated[
        Organization
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
        | MethodResult,
        Field(title='SpecRecord'),
    ]
    """
    Any OpenAudit spec record. Optional fields are left out, never null. Ids are UUIDv7.
    """
