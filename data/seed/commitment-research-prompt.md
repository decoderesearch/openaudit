# Research safety commitments

You research what AI organizations have committed to for one or more safety commitments, and
write the results in `data/seed/commitments/<commitment slug>.json`. The site shows these
results in a table of organizations against commitments, and each cell opens a timeline.

The site is a coordination tool: it shows which organizations made which commitment, how far,
with which exceptions, and how enforceable it is. Be exact and fair. A wrong "Full" or a wrong
"None Found" damages trust in the site.

## Scope

- Research each organization in the file's `orgs` list, and each organization that the task
  names. Today's date is in the task. Look for the newest information: commitments change often.
- A commitment is a public statement by the organization itself (a post, a policy, a framework,
  a signed agreement, a filing), or a law that applies to it. A law applies only when the
  organization or a regulator confirms it (for example, a filing under the law). A third party's
  estimate that the law applies is not enough. Reports by journalists can show that
  a commitment was broken or dropped, but they do not make a commitment.
- Search the organization's own pages first: its safety framework (Responsible Scaling Policy,
  Preparedness Framework, Frontier Safety Framework, and others), its transparency or commitment
  pages, its news posts, its system cards. Then search shared agreements: the 2023 White House
  voluntary commitments, the 2024 Seoul Frontier AI Safety Commitments, the EU General-Purpose AI
  Code of Practice, California SB 53 filings, newer accords (for example a White House accord on
  superintelligence), and agreements with government AI institutes (US CAISI, UK AISI).
- Read the commitment's `summary` and `criteria`. Judge each criterion only by what the sources
  say.

## The file

The top of the file (slug, name, category, order, summary, description, criteria) defines the
commitment. Do not change it unless the task says so. Write only the `orgs` list:

```json
{
  "org": "openai",
  "checkedAt": "2026-11-16",
  "checkedBy": "Claude Opus 5.5 (High)",
  "summary": "OpenAI has agreed to a first phase with four assessors, with deep access. It can redact confidential information.",
  "events": [
    {
      "date": "2026-11-16",
      "kind": "announced",
      "title": "Signs agreements with four embedded assessors",
      "summary": "Apollo Research, METR, Transluce and Goodfire assess alignment and safeguards in training and internal use.",
      "quote": {
        "text": "Assessors maintain independence in publishing their assessments",
        "url": "https://openai.com/index/our-first-phase-of-embedded-assessments/"
      },
      "agreement": "White House Accord on Superintelligence",
      "sources": [
        {
          "url": "https://openai.com/index/our-first-phase-of-embedded-assessments/",
          "title": "Our first phase of embedded assessments",
          "publisher": "OpenAI",
          "date": "2026-11-16"
        }
      ],
      "state": {
        "level": "partial",
        "strength": "agreement",
        "duration": "time_limited",
        "criteria": {
          "deep-access": "met",
          "independent-scope": "partly",
          "free-publication": "partly",
          "permanent": "not_met",
          "frontier-coverage": "partly"
        },
        "verified": ["free-publication"],
        "notes": {
          "deep-access": { "commitment": "Checkpoints, code, data, monitors and staff.", "missing": "No outside report on the access given." },
          "independent-scope": { "commitment": "Assessors set their priorities.", "missing": "Only within topics that OpenAI agreed." },
          "free-publication": { "commitment": "Assessors publish their own findings.", "missing": "OpenAI can redact evidence and delay reports." },
          "permanent": { "missing": "A first phase, with no plan after it." },
          "frontier-coverage": { "commitment": "Selected systems; one training run for METR.", "missing": "Not each new frontier model." }
        },
        "limits": ["Lab can redact", "Disclosure delays", "Pilot phase"]
      }
    }
  ]
}
```

- `org`: the organization's slug (the name of its file in `data/seed/orgs/`).
- `checkedAt`: the day of your research (YYYY-MM-DD). Set it for each organization that you
  checked, also when you found nothing.
- `checkedBy`: your model and its effort, as "Claude Opus 5.5 (High)". Set it with `checkedAt`.
  The organization's page shows it after the date.
- `summary`: the current state in one sentence, at most 25 words. Name the organization in it, as
  "OpenAI has agreed to…" or "Meta's framework says…". The table's popover and the organization's
  pages show it. Leave it out when you found nothing.
- `events`: the timeline, oldest first. Leave the list empty when you found no commitment.

### Events

Add one event for each change: the first commitment (`announced`), a change of terms
(`expanded`, `narrowed`), a renewal (`renewed`), an end (`expired`, `withdrawn`), a public refusal
(`declined`), credible reports that the organization did not keep it (`broken`), and evidence that
it did (`kept`, for example a published assessor report). Do not add an event for each news story
about the same change.

- `date`: as exact as the source (YYYY, YYYY-MM or YYYY-MM-DD).
- `title`: a short headline, 4 to 10 words, with no organization name ("Signs agreements with four
  embedded assessors").
- `summary`: 1 or 2 short sentences, at most 40 words. Write claims as claims ("says it will").
- `quote`: the organization's own words that make or change the commitment, copied exactly. A
  short quote (one or two sentences) is best. Use it for each event that the organization's own
  text supports.
- `agreement`: the shared agreement that the event is part of, by its common name. Leave it out
  for the organization's own policy.
- `sources`: the primary source first (the organization's page or document), then others.
  Each source has `url`, and `title`, `publisher` and `date` when known. Use only strong sources:
  the organization's own pages, court and government records, established news outlets (Reuters,
  AP, Bloomberg, FT, WSJ, NYT, The Verge, Wired, Ars Technica, The Information, TechCrunch), and
  established research or watchdog groups. Do not use personal blogs, trackers, aggregators or
  content farms. If only weak sources show a fact, leave the fact (and its event) out. A document
  that is not on a page is not enough alone for a `broken` event.
- `state`: the state after this event (see below). Each event has a full state, also when it does
  not change.

## The state

### `level`

| Level      | Use when                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `full`     | Each criterion is `met` and `verified`.                                                                                                                                                                                                                                                                                  |
| `partial`  | Some criteria are `met` or `partly`, but not all are `met` and `verified`. Large exceptions also make it `partial`.                                                                                                                                                                                                      |
| `intent`   | The organization says that it will or that it intends to, with no terms, scope or date.                                                                                                                                                                                                                                  |
| `declined` | The organization publicly refused, or said that it will not.                                                                                                                                                                                                                                                             |
| `dropped`  | The organization had the commitment, then withdrew it, let it expire, or removed it from its policy.                                                                                                                                                                                                                     |
| `broken`   | The organization confirms that it did not keep it, a court or regulator finds this, or the public facts show it and the organization does not dispute them. If it disputes a credible report, or says the commitment does not apply, use the event kind `broken` but keep the earlier level. Write the claim as a claim. |

With no events, the level is "None Found". Do not write `none_found` in an event.

The import refuses `full` when a criterion is not `met` or not `verified`, and `partial` when all
are `met` and `verified`.

### `criteria`

For each criterion of the commitment: `met`, `partly` or `not_met`. Leave out a criterion that
the sources do not tell. Do not guess: a criterion that the organization does not mention is
`not_met` only when the commitment's text clearly does not include it.

### `verified`

The keys of the `met` or `partly` criteria that are independently verified: a party that the
organization does not control can check that the organization does it, and the result is public.
A promise, a law or a policy alone does not make a criterion verified, because an organization can
fail to comply in secret.

Verified, for example:

- A public artifact that anyone can check: a system card published at release, a published
  framework with its change log, a public grants list. It verifies what it shows on its face (that
  it exists, when it came out, what it includes), not the organization's claims in it about what
  it does elsewhere. When a criterion asks for results, the artifact is not enough: an outside
  party must publish its own results on the same subject.
- An outside evaluator, auditor or regulator that checked it and published what it found, with no
  veto by the organization.
- A court record or regulator finding.

Not verified, for example:

- The organization's own claim that it complies, also in a system card.
- A confidential report to a government, when no one outside publishes the result.
- An audit or review whose findings the organization can veto or change. Redaction of
  confidential details is acceptable when the reviewer can tell what was redacted and the
  organization cannot block its conclusions.
- An outside party that can publish, but has not published yet.

Each criterion gives up to 1 point: 0.5 when the organization commits to it, and 0.5 more when it is
verified. A `partly` criterion gets half of each. Only `full` shows a check after the level. Leave
`verified` out when no criterion is verified. The import refuses a key that is not `met` or
`partly`.

### `notes`

For each criterion of the commitment, by its key: where the organization is now, in two parts.
The organization's page shows them as columns next to the criterion's description ("Target
Criteria"). Each part is a phrase or one short sentence, at most 15 words. Do not repeat the
criterion's description.

- `commitment` ("Commitment"): only what the organization commits to or does. Needed for a `met`
  or `partly` criterion. Leave it out when there is nothing.
- `missing` ("What's Missing"): only what is missing for the criterion to be met and verified.
  Needed unless the criterion is `met` and verified; leave it out then. For a criterion that is
  met but not verified, tell what check is missing ("No outside report on the access given."). For
  a criterion with no mark, tell what you did not find ("No statement on training data access.").

The newest event's state must have a note for each criterion. Older events can leave `notes` out.

The newest state shows what the organization does now. Its criteria, its notes and the entry's
`summary` count a lapse only when it came after the newest event that changed the commitment (a
new law, policy or agreement), or in the past 12 months, or when it continues now (for example, a
pledge that it never delivered). A lapse about one past release that later releases do not repeat
stays in the timeline as its own event only. For example: a model card that came late in 2025,
before a 2026 law made cards required, is not "missing" in the 2026 state.

### `strength`

How enforceable the commitment is:

- `statement`: a blog post, a talk or a tweet. The organization can change it at any time.
- `policy`: in a published policy or framework that has a change process (version history,
  board approval).
- `agreement`: signed with other parties: a shared accord, a contract with assessors, or an
  agreement with a government institute.
- `law`: a law or regulation requires it, in a place where the organization operates (for
  example SB 53 for frontier developers in California, the EU AI Act).

Use the strongest that applies to the commitment itself. Leave it out for `declined`.

### `duration`, `endDate`

`ongoing`, or `time_limited` for a pilot, a single engagement or a term with an end. Give
`endDate` when the source tells it.

### `condition`

When the commitment depends on others, give the condition in a few words: "If all frontier labs
agree", "If a law requires it", "Unless competitors continue". Leave it out with no condition. A
clause that lets the organization skip the commitment because others do not keep it is a
condition too ("Unless competitors continue").

### `limits`

The exceptions and limits that matter, each in 2 to 5 words: "Lab can redact", "Disclosure
delays", "One training run only", "US government only". At most 5. The criteria already show
what is missing; use `limits` for the details that they do not show.

## Rules

- Never invent a source, a quote or a date. Open each source and check it. A quote must be in its
  source, word for word.
- Prefer the organization's own pages. For `broken` and `dropped`, cite the reports and, when it
  exists, the organization's reply.
- Use neutral words. Do not praise or blame. "None Found" means that we found nothing, not that
  the organization refuses.
- Each organization that you checked gets `checkedAt` and `checkedBy`, also with no events.
- Keep the JSON valid. Run the check from `apps/web`:

  ```bash
  pnpm exec tsx scripts/check-commitments.ts
  ```

  Fix each problem that it shows.
