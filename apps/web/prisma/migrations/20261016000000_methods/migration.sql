
-- CreateTable
CREATE TABLE "method_family" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "safetyUse" TEXT NOT NULL,
    "caveats" TEXT[],
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "summary" TEXT,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_comparison_set" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "baseModel" TEXT NOT NULL,
    "modelId" UUID,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_comparison_set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_artifact" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "methodId" UUID NOT NULL,
    "comparisonSetId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "layer" INTEGER,
    "hook" TEXT,
    "width" INTEGER,
    "trainingTokens" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_result" (
    "id" UUID NOT NULL,
    "artifactId" UUID NOT NULL,
    "evalVersionId" UUID NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sourceCommit" TEXT,
    "measuredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "method_family_slug_key" ON "method_family"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "method_familyId_slug_key" ON "method"("familyId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "method_comparison_set_slug_key" ON "method_comparison_set"("slug");

-- CreateIndex
CREATE INDEX "method_comparison_set_familyId_idx" ON "method_comparison_set"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "method_artifact_key_key" ON "method_artifact"("key");

-- CreateIndex
CREATE INDEX "method_artifact_methodId_idx" ON "method_artifact"("methodId");

-- CreateIndex
CREATE INDEX "method_artifact_comparisonSetId_idx" ON "method_artifact"("comparisonSetId");

-- CreateIndex
CREATE INDEX "method_result_evalVersionId_idx" ON "method_result"("evalVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "method_result_artifactId_evalVersionId_metric_key" ON "method_result"("artifactId", "evalVersionId", "metric");

-- AddForeignKey
ALTER TABLE "method" ADD CONSTRAINT "method_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "method_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_comparison_set" ADD CONSTRAINT "method_comparison_set_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "method_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_comparison_set" ADD CONSTRAINT "method_comparison_set_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_artifact" ADD CONSTRAINT "method_artifact_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_artifact" ADD CONSTRAINT "method_artifact_comparisonSetId_fkey" FOREIGN KEY ("comparisonSetId") REFERENCES "method_comparison_set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_result" ADD CONSTRAINT "method_result_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "method_artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_result" ADD CONSTRAINT "method_result_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
