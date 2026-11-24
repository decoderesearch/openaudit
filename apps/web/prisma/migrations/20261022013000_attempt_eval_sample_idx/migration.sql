-- For the `evalSampleId` foreign key: without it, each deleted sample scans all attempts.
CREATE INDEX "eval_attempt_evalSampleId_idx" ON "eval_attempt"("evalSampleId") WHERE ("evalSampleId" IS NOT NULL);
