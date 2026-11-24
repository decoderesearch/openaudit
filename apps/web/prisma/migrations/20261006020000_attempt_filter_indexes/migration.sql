-- The attempt list filters by passed or status, in ordinal order.
DROP INDEX "eval_attempt_runId_passed_idx";

CREATE INDEX "eval_attempt_runId_passed_ordinal_idx" ON "eval_attempt"("runId", "passed", "ordinal");

CREATE INDEX "eval_attempt_runId_status_ordinal_idx" ON "eval_attempt"("runId", "status", "ordinal");
