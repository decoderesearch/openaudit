-- Eval runs (also the runner's job queue), their attempts, and measured results that point to a run.
-- AlterTable
ALTER TABLE "eval_result" ADD COLUMN     "evalRunId" UUID;

-- CreateTable
CREATE TABLE "eval_run" (
    "id" UUID NOT NULL,
    "evalId" UUID NOT NULL,
    "evalVersionId" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "route" JSONB NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "logKey" TEXT,
    "logBytes" INTEGER,
    "logSha256" TEXT,
    "sampleCount" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "ownerUserId" UUID,
    "visibility" TEXT NOT NULL,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "tries" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_attempt" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sampleId" TEXT NOT NULL,
    "evalSampleId" UUID,
    "epoch" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "passed" BOOLEAN,
    "input" TEXT,
    "target" JSONB,
    "choices" TEXT[],
    "output" TEXT,
    "scores" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "seconds" DOUBLE PRECISION,
    "bodyKey" TEXT,
    "bodyBytes" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eval_run_logSha256_key" ON "eval_run"("logSha256");

-- CreateIndex
CREATE INDEX "eval_run_status_createdAt_idx" ON "eval_run"("status", "createdAt");

-- CreateIndex
CREATE INDEX "eval_run_modelId_idx" ON "eval_run"("modelId");

-- CreateIndex
CREATE INDEX "eval_run_evalId_idx" ON "eval_run"("evalId");

-- CreateIndex
CREATE INDEX "eval_attempt_runId_passed_idx" ON "eval_attempt"("runId", "passed");

-- CreateIndex
CREATE UNIQUE INDEX "eval_attempt_runId_sampleId_epoch_key" ON "eval_attempt"("runId", "sampleId", "epoch");

-- CreateIndex
CREATE UNIQUE INDEX "eval_attempt_runId_ordinal_key" ON "eval_attempt"("runId", "ordinal");

-- CreateIndex
CREATE INDEX "eval_result_evalRunId_idx" ON "eval_result"("evalRunId");

-- AddForeignKey
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_evalRunId_fkey" FOREIGN KEY ("evalRunId") REFERENCES "eval_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_evalId_fkey" FOREIGN KEY ("evalId") REFERENCES "eval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_runId_fkey" FOREIGN KEY ("runId") REFERENCES "eval_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_evalSampleId_fkey" FOREIGN KEY ("evalSampleId") REFERENCES "eval_sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;


ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_values_check" CHECK (
  "origin" IN ('run', 'import')
  AND "status" IN ('queued', 'running', 'importing', 'succeeded', 'failed', 'cancelled')
  AND "visibility" IN ('private', 'unlisted', 'public')
);

ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_values_check" CHECK (
  "status" IN ('success', 'error') AND "ordinal" >= 1 AND "epoch" >= 1
);

ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_measured_run_check" CHECK (
  ("origin" = 'measured') = ("evalRunId" IS NOT NULL)
);
