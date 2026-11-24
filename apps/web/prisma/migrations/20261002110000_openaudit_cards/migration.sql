-- CreateTable
CREATE TABLE "openaudit_card" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "staleSince" TIMESTAMPTZ(3),
    "staleAt" TIMESTAMPTZ(3),
    "builtAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "openaudit_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openaudit_card_version" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "aggregator" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSha256" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "verdicts" JSONB NOT NULL DEFAULT '[]',
    "topics" JSONB NOT NULL DEFAULT '[]',
    "gaps" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openaudit_card_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openaudit_card_run" (
    "versionId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "evalVersionId" UUID NOT NULL,

    CONSTRAINT "openaudit_card_run_pkey" PRIMARY KEY ("versionId","runId")
);

-- CreateTable
CREATE TABLE "openaudit_snippet" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "excerpt" JSONB NOT NULL,
    "flagger" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openaudit_snippet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openaudit_card_snippet" (
    "versionId" UUID NOT NULL,
    "snippetId" UUID NOT NULL,

    CONSTRAINT "openaudit_card_snippet_pkey" PRIMARY KEY ("versionId","snippetId")
);

-- CreateTable
CREATE TABLE "openaudit_flag_check" (
    "attemptId" UUID NOT NULL,
    "flagger" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "flags" INTEGER NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "checkedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "openaudit_flag_check_pkey" PRIMARY KEY ("attemptId","flagger","promptVersion")
);

-- CreateIndex
CREATE UNIQUE INDEX "openaudit_card_modelId_key" ON "openaudit_card"("modelId");

-- CreateIndex
CREATE INDEX "openaudit_card_staleAt_idx" ON "openaudit_card"("staleAt");

-- CreateIndex
CREATE UNIQUE INDEX "openaudit_card_version_cardId_number_key" ON "openaudit_card_version"("cardId", "number");

-- CreateIndex
CREATE INDEX "openaudit_card_run_runId_idx" ON "openaudit_card_run"("runId");

-- CreateIndex
CREATE INDEX "openaudit_snippet_runId_idx" ON "openaudit_snippet"("runId");

-- CreateIndex
CREATE INDEX "openaudit_snippet_attemptId_idx" ON "openaudit_snippet"("attemptId");

-- CreateIndex
CREATE INDEX "openaudit_card_snippet_snippetId_idx" ON "openaudit_card_snippet"("snippetId");

-- AddForeignKey
ALTER TABLE "openaudit_card" ADD CONSTRAINT "openaudit_card_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_version" ADD CONSTRAINT "openaudit_card_version_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "openaudit_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_run" ADD CONSTRAINT "openaudit_card_run_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "openaudit_card_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_run" ADD CONSTRAINT "openaudit_card_run_runId_fkey" FOREIGN KEY ("runId") REFERENCES "eval_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_run" ADD CONSTRAINT "openaudit_card_run_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_snippet" ADD CONSTRAINT "openaudit_snippet_runId_fkey" FOREIGN KEY ("runId") REFERENCES "eval_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_snippet" ADD CONSTRAINT "openaudit_card_snippet_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "openaudit_card_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openaudit_card_snippet" ADD CONSTRAINT "openaudit_card_snippet_snippetId_fkey" FOREIGN KEY ("snippetId") REFERENCES "openaudit_snippet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

