-- CreateTable
CREATE TABLE "system_card" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "alsoDocumentIds" UUID[],
    "covers" JSONB NOT NULL DEFAULT '[]',
    "modelIds" UUID[],
    "basedOnDocumentId" UUID,
    "pageCount" INTEGER,
    "disclosures" JSONB NOT NULL DEFAULT '{}',
    "riskDecisions" JSONB NOT NULL DEFAULT '[]',
    "topics" JSONB NOT NULL DEFAULT '[]',
    "testers" JSONB NOT NULL DEFAULT '[]',
    "findings" JSONB NOT NULL DEFAULT '[]',
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "extractionBy" TEXT NOT NULL,
    "extractionAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_result" (
    "id" UUID NOT NULL,
    "origin" TEXT NOT NULL,
    "evalId" UUID,
    "evalVersionId" UUID,
    "rawEvalName" TEXT,
    "modelId" UUID,
    "rawModelName" TEXT,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "stderr" DOUBLE PRECISION,
    "ciLow" DOUBLE PRECISION,
    "ciHigh" DOUBLE PRECISION,
    "n" INTEGER,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "sourceDocumentId" UUID,
    "sourcePage" TEXT,
    "sourceTable" TEXT,
    "sourceQuote" TEXT,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "extractionBy" TEXT,
    "extractionAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_card_documentId_key" ON "system_card"("documentId");

-- CreateIndex
CREATE INDEX "system_card_modelIds_idx" ON "system_card" USING GIN ("modelIds");

-- CreateIndex
CREATE INDEX "eval_result_modelId_idx" ON "eval_result"("modelId");

-- CreateIndex
CREATE INDEX "eval_result_evalId_idx" ON "eval_result"("evalId");

-- CreateIndex
CREATE INDEX "eval_result_sourceDocumentId_idx" ON "eval_result"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "system_card" ADD CONSTRAINT "system_card_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_evalId_fkey" FOREIGN KEY ("evalId") REFERENCES "eval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rules from spec/schemas/eval_result.yaml.
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_enums_check" CHECK (
  "origin" IN ('reported', 'measured')
  AND ("unit" IS NULL OR "unit" IN ('fraction', 'percent', 'score', 'count', 'seconds', 'tokens', 'other'))
);
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_model_check" CHECK ("modelId" IS NOT NULL OR "rawModelName" IS NOT NULL);
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_reported_check" CHECK (
  "origin" <> 'reported' OR ("rawEvalName" IS NOT NULL AND "sourceDocumentId" IS NOT NULL)
);
