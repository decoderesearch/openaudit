-- Methods move to Method > MethodVariant > MethodArtifact. Comparison sets go away: artifacts keep
-- their sites and params. The seed import fills the new tables again.
DROP TABLE "method_result";
DROP TABLE "method_artifact";
DROP TABLE "method_comparison_set";
DROP TABLE "method_expert_view";
DROP TABLE "method";
DROP TABLE "method_family";

-- AlterTable
ALTER TABLE "eval_version" ADD COLUMN "methodSetup" JSONB;

-- CreateTable
CREATE TABLE "method" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "safetyUse" TEXT NOT NULL,
    "caveats" TEXT[],
    "params" JSONB NOT NULL DEFAULT '[]',
    "compare" JSONB NOT NULL DEFAULT '{"groupBy":[]}',
    "brief" JSONB,
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_expert_view" (
    "id" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "variantIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "title" TEXT NOT NULL,
    "byline" TEXT NOT NULL,
    "organization" TEXT,
    "publishedDate" TEXT NOT NULL,
    "stance" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "points" TEXT[],
    "quotes" JSONB NOT NULL DEFAULT '[]',
    "sources" JSONB NOT NULL,
    "checkedDate" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_expert_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_variant" (
    "id" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "summary" TEXT,
    "access" TEXT NOT NULL,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    "componentIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "supersedesId" UUID,
    "params" JSONB NOT NULL DEFAULT '[]',
    "brief" JSONB,
    "links" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_artifact" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "variantId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "modelId" UUID,
    "revision" TEXT,
    "sites" JSONB NOT NULL DEFAULT '[]',
    "params" JSONB NOT NULL DEFAULT '{}',
    "license" TEXT,
    "sourceUrl" TEXT,
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
    "stderr" DOUBLE PRECISION,
    "n" INTEGER,
    "sourceUrl" TEXT NOT NULL,
    "sourceTable" TEXT,
    "sourceCommit" TEXT,
    "measuredAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "method_slug_key" ON "method"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "method_expert_view_methodId_slug_key" ON "method_expert_view"("methodId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "method_variant_methodId_slug_key" ON "method_variant"("methodId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "method_artifact_key_key" ON "method_artifact"("key");

-- CreateIndex
CREATE INDEX "method_artifact_variantId_idx" ON "method_artifact"("variantId");

-- CreateIndex
CREATE INDEX "method_artifact_modelId_idx" ON "method_artifact"("modelId");

-- CreateIndex
CREATE INDEX "method_artifact_subject_idx" ON "method_artifact"("subject");

-- CreateIndex
CREATE INDEX "method_result_evalVersionId_idx" ON "method_result"("evalVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "method_result_artifactId_evalVersionId_metric_key" ON "method_result"("artifactId", "evalVersionId", "metric");

-- AddForeignKey
ALTER TABLE "method_expert_view" ADD CONSTRAINT "method_expert_view_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_variant" ADD CONSTRAINT "method_variant_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "method"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_variant" ADD CONSTRAINT "method_variant_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "method_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_artifact" ADD CONSTRAINT "method_artifact_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "method_variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_artifact" ADD CONSTRAINT "method_artifact_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_result" ADD CONSTRAINT "method_result_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "method_artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_result" ADD CONSTRAINT "method_result_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
