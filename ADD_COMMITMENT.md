# Update safety commitments

This guide tells an agent how to update the safety commitments of AI organizations: find what
changed on the web, write it in the seed files, check it, and import it. Follow the steps in order.

The repo root is the folder of this file. Run commands from `apps/web` unless a step says
the repo root.

## The pages

- `/organizations/commitments`: a table of commitments against organizations, with each
  organization's total score. Partial and Full are a bar that the points fill; other levels show
  their word ("None" for None Found). A hover shows the summary.
- `/organizations/commitments/<slug>`: one commitment for all organizations: the level and each
  criterion, and one timeline.
- `/<org>/commitments`: one organization's commitments by category, with its total score. The
  organization's side column has a "Safety Commitments" row with the score bar.
- `/<org>/commitments/<slug>`: one organization's state and summary, a table of each criterion's
  commitment, what is missing and its score, the timeline with sources, and "Checked <date> by
  <checkedBy>".

## The data

- `data/seed/commitments/<slug>.json`: one file for each commitment. The top defines the
  commitment and its criteria. `orgs` has each organization's timeline. The format and the
  research rules are in `data/seed/commitment-research-prompt.md`.
- The spec is `spec/schemas/commitment.yaml`. The tables are `commitment`, `org_commitment` and
  `org_commitment_event`.
- An organization's state is the state of its newest event. With no events, it is None Found.

## Rules

- Do not push, and do not open a pull request. The remotes are public.
- Commit only when the user asks. Add files by explicit path: other agents work in this repo at the
  same time.
- `pnpm seed:import --apply` writes to the database. Use the dev database. Write to the
  production database only when the user says so.
- Never print secrets: filter `postgres://` and `npg_` out of any output you show.
- Do not change an old event to show a new state. Add a new event. Change an old event only to fix
  an error in it.

## 1. Find what changed

Search for news since the newest `checkedAt` in the files. Look at:

- Each organization's safety framework and its change log: Anthropic's Responsible Scaling Policy,
  OpenAI's Preparedness Framework, Google DeepMind's Frontier Safety Framework, Meta's frontier AI
  framework, xAI's frameworks, Microsoft's and Amazon's frameworks (`apps/web/lib/frameworks.ts`
  has their URLs).
- Each organization's news, safety, transparency and policy pages, and its system cards.
- Shared agreements and laws: new accords, government agreements (US CAISI, UK AISI), the EU AI
  Act and its Code of Practice, California SB 53 and New York's RAISE Act.
- Reports that an organization dropped or did not keep a commitment. The incidents in
  `data/seed/orgs/<org>.json` with the category `safety_related_cut` are a good start.

Make a list: for each change, the organization, the commitment and the source.

## 2. Write the changes

Follow `data/seed/commitment-research-prompt.md`. For each change, add an event to the
organization's entry, with the full state after it, a quote and sources. Update the entry's
`summary`, `checkedAt`, `checkedBy`, and the `notes` of the newest state. Set `checkedAt` and
`checkedBy` on each entry that you checked, also with no change. `checkedBy` is the model that did
the research and its effort, as "Claude Opus 5.5 (High)". The import refuses an entry without it.

Large updates go faster with one subagent for each one or two commitments. Give each subagent the
research prompt file, the files that it may edit (only its own), today's date and the
organizations. Tell it not to edit other files, not to import and not to commit. Each subagent
sets `checkedBy` to its own model and effort.

### A new commitment

Add `data/seed/commitments/<slug>.json` with a new `order`, a `summary` (the ideal form in one
sentence), a `description` (why it matters) and 3 to 5 `criteria`. Each criterion is one thing
that an organization can do, with a short label. Do not add a criterion for outside checks: the
`verified` list covers them for each criterion. Then research each organization in the table.

### A new organization

Add an entry for it to each file. Its slug is the name of its file in `data/seed/orgs/`.

## 3. Check

```bash
pnpm exec tsx scripts/check-commitments.ts
```

Fix each problem that it shows. Then review each new event:

- The quote is in its source, word for word. Open the source.
- The level agrees with the criteria. A cell is `full` only when each criterion is `met` and
  `verified`.
- Each note agrees with its criterion's mark. `commitment` tells only what is there, and
  `missing` only what is missing.
- Each `verified` criterion has a public check by a party that the organization does not control.
  A law, a policy or the organization's own report is not enough.
- The strength is right: a blog post is a `statement`, not a `policy`.
- The words are neutral, and claims are written as claims.

For many new events, ask a subagent with a model of another lab to check them against their
sources (the same rule as `spec/model-ladders.yaml`: no lab grades itself).

## 4. Import

From `apps/web`. First the plan, then the write:

```bash
pnpm seed:import --only commitments
pnpm seed:import --only commitments --apply
```

The import refuses all files when one file has a problem.

## 5. Check the pages

Open the four pages above on desktop and at phone width:

- The table shows each organization and each commitment. A hover on a cell shows its card.
- The commitment page shows the criteria marks and the timeline.
- The organization's side column shows the "Safety Commitments" row with the counts and score.
- The organization's commitment page shows the checked date and model.

## Change the format

The format is in `spec/schemas/commitment.yaml`. After a change, run `pnpm spec:generate` from the
repo root, and change `scripts/commitments.ts` and its test. A new column needs a Prisma migration
(`apps/web/prisma/migrations/`). The pages are in `apps/web/app/organizations/commitments/` and
`apps/web/app/[owner]/(org)/commitments/`, with their parts in `apps/web/components/commitments/`.
