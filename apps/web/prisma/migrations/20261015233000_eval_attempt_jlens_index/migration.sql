-- CreateIndex
CREATE INDEX "eval_attempt_jlens_idx" ON "eval_attempt"("runId", "id" DESC) WHERE (hazard IS NULL AND status = 'success' AND "bodyKey" IS NOT NULL AND (display IS NULL OR display = 'open') AND (tokens ->> 'input')::numeric > 0 AND (tokens ->> 'input')::numeric + COALESCE((tokens ->> 'output')::numeric, 0) <= 2048);
