-- A run can wait as `requested` until an admin approves it.
ALTER TABLE "eval_run" DROP CONSTRAINT "eval_run_values_check";

ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_values_check" CHECK (
  "origin" IN ('run', 'import', 'rescore')
  AND ("origin" = 'rescore') = ("sourceRunId" IS NOT NULL)
  AND "status" IN ('requested', 'queued', 'running', 'importing', 'succeeded', 'failed', 'cancelled')
  AND "visibility" IN ('private', 'unlisted', 'public')
);
