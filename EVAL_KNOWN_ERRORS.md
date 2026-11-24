# Known errors in eval samples

Some eval samples are broken: the answer key is wrong, the question lost the text it refers to, or the
prompt asks for what the grader marks as a failure. Every model fails such a sample, and that failure
says nothing about the models. This guide tells how OpenAudit records these samples, what changes when
staff confirm one, and how to audit an eval for them.

Run commands from `apps/web` unless a step says otherwise.

## Rules

- A review by an LLM only proposes issues. Staff confirm or reject each one. Only a confirmed issue
  changes scores.
- A note is one plain sentence for the public. It must not repeat hazardous content: no procedures,
  quantities, targets or exploit details (WMDP and FORTRESS samples especially).
- An issue is about the sample, not about one reply. A grader that misreads one reply's format is an
  attempt problem: do not record it here. Record a grader error only when the grader fails the same
  way for every model on that sample.
- Ask the user before `--apply` on a shared database and before a prod sync. Show the dry run first.
- Never print secrets: filter `postgres://` out of any output you show.

## The data

Table `eval_sample_issue` (Prisma `EvalSampleIssue`), one row for each sample at most:

| Column                     | Values                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------- |
| `kind`                     | `label_error`, `missing_context`, `prompt_conflict`, `grader_error`, `other`        |
| `status`                   | `proposed` (default), `confirmed`, `rejected`                                       |
| `effect`                   | `exclude` (default): leave the sample out of the counts. `note`: show the note only |
| `source`                   | `llm_review`, `staff`, `report`, `upstream`                                         |
| `note`                     | The public sentence                                                                 |
| `evidence`                 | JSON: the review verdict, and the `failed` and `graded` counts when it was found    |
| `reviewedBy`, `reviewedAt` | The staff member's email and the time of the confirm or reject                      |

SQL `CHECK` constraints hold the values. The migration is
`apps/web/prisma/migrations/20261023100000_sample_issues`.

## What a confirmed `exclude` issue changes

- **Eval page, Evaluation Runs:** `runTallies` (`lib/server/runs.ts`) leaves the sample's attempts out
  of Pass / Fail. When any run has such attempts, the result column becomes **Adjusted Pass Rate**:
  the passed share of the other graded attempts. The models rank by it, worst first. The headline
  metric of each run still includes the sample; the cell's title shows it.
- **Eval page, Eval Samples:** `refresh_sample_stats` sets the sample's `failed` to 0, so the
  "Failed" order puts it at the end. The row shows a "Known error" tag in place of the count.
- **Sample pages:** a banner shows the kind and the note, and links to the list.
- **Known Errors page:** `/evaluations/<slug>/known-errors` lists the confirmed issues of the newest
  version. The eval page links to it when the eval has one. Admins also see the proposed and
  rejected issues there, and confirm, reject or reopen them. A note shows only to readers who can
  read the samples under the dataset terms.
- **Flagger:** `candidates()` in `apps/runner/openaudit_runner/cards.py` skips the sample's attempts.

The official results (`eval_result`) do not change. System cards and model cards use them.

## Audit an eval

1. Find the samples that more than 10 models failed (`eval_sample.failed > 10`). The count uses
   each model's newest replies, with their newest grades: a finished re-score replaces its source
   run (`refresh_sample_stats`). Count them for each eval:

   ```sql
   SELECT e.slug, count(*) FILTER (WHERE s.failed > 10) AS n
   FROM eval_sample s JOIN eval_version v ON v.id = s."evalVersionId" JOIN eval e ON e.id = v."evalId"
   GROUP BY e.slug HAVING count(*) FILTER (WHERE s.failed > 10) > 0 ORDER BY n DESC;
   ```

2. Export each sample with its target, choices, input and a few failed replies with their scores and
   judge explanations. Give the eval's description and scores too: the reviewer must know what a
   pass means.
3. Review with an LLM, about 100 samples for each reviewer. Each sample gets one verdict and one
   reason:

   | Verdict           | Meaning                                                      | Loads as          |
   | ----------------- | ------------------------------------------------------------ | ----------------- |
   | `label_error`     | The key is wrong, or two options are equally right           | `label_error`     |
   | `missing_context` | The question needs text that the sample does not have        | `missing_context` |
   | `prompt_conflict` | The prompt asks for what the grader marks as a failure       | `prompt_conflict` |
   | `grader_error`    | The grader fails the same way for every model on this sample | `grader_error`    |
   | `judge_error`     | The grader misread some replies                              | not loaded        |
   | `debatable`       | The key is defensible, but experts could disagree            | not loaded        |
   | `model_failure`   | The key and grading are right                                | not loaded        |

   Be strict: a dataset verdict needs evidence in the sample itself. Many models that agree on
   another option is a signal, not proof. When staff decide on a pattern (for example ALCUNA
   answers that follow from the listed facts), give all samples of the pattern the same verdict.

   Give the reviewer the full prompt. The attempt's `input` keeps only 2000 characters, so read
   the prompt from the transcript (the target's messages before its first reply). Some evals
   shuffle the choices in each attempt: give each reply its own target and choice order.

4. Load the dataset verdicts as proposed issues. The file is a JSON array of
   `{ slug?, split?, sourceId, verdict, reason }`. A sample that has an issue keeps it. With
   `--replace`, a new review replaces a proposed issue of an LLM review, and deletes it when the new
   verdict is not a dataset error. Staff reviews do not change. A dry run by default:

   ```bash
   node scripts/with-env.mjs pnpm exec tsx scripts/load-sample-issues.ts verdicts.json --slug <slug>
   node scripts/with-env.mjs pnpm exec tsx scripts/load-sample-issues.ts verdicts.json --slug <slug> --apply
   ```

5. Staff read each proposed issue on the Known Errors page, open the sample, and confirm or reject.
   Confirm runs `refresh_sample_stats` for the version.
6. Prod sync (`/admin/sync`) copies the issues of samples that production has. When both sides have
   a row for a sample, the newer `updatedAt` wins, so a review on either side holds.

## Audit results

The first audit, of the samples that more than 10 of about 20 models failed (October 2026). All
loaded issues are `proposed`: no score changes until staff confirm them.

The first review saw only the stored 2000 characters of each prompt. 30 of its samples had a cut
prompt (19 AbstentionBench, 7 FACTS Grounding, 4 BrokenMath). A second review read their full
prompts from the transcripts. It added 11 AbstentionBench issues (ALCUNA and MuSiQue) and 2 FACTS
Grounding issues. A field check of FACTS Grounding found 5 more.

The first counts used the old judges' grades of 84 runs. With the re-scores in their place, 114
more samples had more than 10 failures (106 AbstentionBench, 6 BrokenMath, 1 DeceptionBench, 1
FACTS Grounding). Their review added 37 issues. Staff also decided that ALCUNA answers that follow
from the listed facts are label errors, which added 19.

| Eval            | Reviewed  | Loaded | Kinds                                                   |
| --------------- | --------- | ------ | ------------------------------------------------------- |
| AbstentionBench | 349       | 145    | 108 label error, 19 missing context, 18 prompt conflict |
| WMDP            | 77 of 154 | 12     | 12 label error                                          |
| BrokenMath      | 39        | 2      | 2 label error                                           |
| DeceptionBench  | 12        | 6      | 6 prompt conflict                                       |
| FACTS Grounding | 8 + 860   | 9      | 4 label error, 1 missing context, 4 prompt conflict     |
| FORTRESS        | 0 of 85   | 0      |                                                         |

The reports for the dataset owners are drafts in `openaudit-private/to_report/` (maintainers only), one file for each repo. Do not post
them without a staff review.

Patterns:

- **AbstentionBench:** SelfAware and similar sources lost the passage of SQuAD-based questions ("What
  does this result in?"), but the label still says the question is answerable. MoralChoice keys
  conflict with prompts that forbid abstention.
- **WMDP:** wrong or ambiguous keys, and two options that say the same thing.
- **BrokenMath:** two perturbed statements are still true, so a proof is correct.
- **DeceptionBench:** in six sandbagging scenarios the user asks for wrong answers, so a wrong answer
  follows the request.
- **FACTS Grounding:** in 6 of the 860 public rows, `user_request` (what the judges get) asks a
  different question than `full_prompt` (what the model gets). The eligibility judges then fail every
  correct reply. `facts_task.py` sets `request_mismatch` in these samples' metadata and logs them.
- The LLM review of the other 77 WMDP samples and of FORTRESS stopped: the provider's usage policy
  blocks hazardous content. Staff must review them by hand.

Found on the way, not a sample error: in WMDP, some models answered `ANSWER: $D` (with the `$` of the
template's `$LETTER`). Inspect's multiple-choice parser read no letter, so the attempt failed.
`openaudit_runner/mc_answer.py` now reads it in new runs, and a one-off script graded the stored
attempts again: 956 attempts in 3 runs. Gemini 3.1 Flash-Lite went
from 27.0% to 85.3% accuracy.
