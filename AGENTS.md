# Notes for agents

- Default models for our own LLM jobs (card aggregator, chat flagger, auditor fallbacks, and new
  jobs such as our own judges) are in `spec/model-ladders.yaml`. Do not write model names in code.
  Read them with `role_models` / `tier_models` (`apps/runner/openaudit_runner/ladders.py`) or
  `roleModels` / `tierModels` (`apps/web/lib/model-ladders.ts`). These skip models of the target's
  lab. For a new job, add a role. After a change, run `pnpm spec:generate`.
- Each eval slot (judge, auditor, simulated user) in a runner spec names the lowest good-enough
  `tier`, plus `labs` (in order) and `sameLab` for panels. Runs get the tier's first allowed model and the
  rest as fallbacks (`tier_routes` / `tierRoutes`). Do not pin a slot model; `default` only records
  the task's own default.
- To add a new model (documents, system card and eval runs), follow `ADD_MODEL.md`.
- To add an eval that we can run, follow `ADD_AN_EVAL.md`.
- To add a safety method, follow `ADD_A_METHOD.md`. To add an eval of methods, follow
  `ADD_A_METHOD_EVAL.md`.
- To import a system card, follow `IMPORT_SYSTEM_CARD.md`.
- To review a submission, follow `openaudit-private/process/review-submissions.md` if you have access
  to it (do not copy its steps to this repo). Run submitted code only on a new pod with `submissions/run-isolated.sh`.
- When you change the agent guide (`apps/web/app/contribute/agents.md/route.ts`), set
  `AGENT_GUIDE_VERSION` to the date. When you change a harness in `evals/`, run again the examples
  in `submissions/examples/` that use it, and `node submissions/leaderboards.mjs`.
- To add an incident or rewrite its page (description and log excerpts), follow `ADD_INCIDENT.md`.
- To update organizations' safety commitments, or add a commitment, follow `ADD_COMMITMENT.md`.
- Dev and production share the R2 bucket. Sync (`/admin/sync` on the local server) copies runs to
  production with the same ids and R2 keys. Make and import runs on dev only; production gets them
  by sync. Delete run files only with `openaudit-runner delete-run-files`: it checks each database.
- `pnpm dev:prod` (in `apps/web`) runs the local server on production, read-only, on port 3310. Not 3301:
  the e2e tests use any server on 3301.
