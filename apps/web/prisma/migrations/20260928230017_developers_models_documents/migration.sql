-- CreateTable
CREATE TABLE "developer" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "developer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "developerId" UUID NOT NULL,
    "family" TEXT,
    "revision" TEXT,
    "aliases" TEXT[],
    "parentId" UUID,
    "parentRelation" TEXT,
    "removedFromHub" BOOLEAN NOT NULL DEFAULT false,
    "facts" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "model_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publisherId" UUID NOT NULL,
    "publishedDate" TEXT,
    "sha256" TEXT,
    "fetchedAt" TIMESTAMPTZ(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_document" (
    "modelId" UUID NOT NULL,
    "documentId" UUID NOT NULL,

    CONSTRAINT "model_document_pkey" PRIMARY KEY ("modelId","documentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "developer_slug_key" ON "developer"("slug");

-- CreateIndex
CREATE INDEX "model_developerId_idx" ON "model"("developerId");

-- CreateIndex
CREATE INDEX "model_parentId_idx" ON "model"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "model_source_name_key" ON "model"("source", "name");

-- CreateIndex
CREATE UNIQUE INDEX "document_key_key" ON "document"("key");

-- CreateIndex
CREATE INDEX "document_publisherId_idx" ON "document"("publisherId");

-- CreateIndex
CREATE INDEX "model_document_documentId_idx" ON "model_document"("documentId");

-- AddForeignKey
ALTER TABLE "model" ADD CONSTRAINT "model_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model" ADD CONSTRAINT "model_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "developer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_document" ADD CONSTRAINT "model_document_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_document" ADD CONSTRAINT "model_document_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Checks that Prisma cannot express. The spec has the same rules.
ALTER TABLE "model" ADD CONSTRAINT "model_source_check" CHECK ("source" IN ('hf', 'api'));
ALTER TABLE "model" ADD CONSTRAINT "model_parent_check" CHECK (
  ("parentId" IS NULL AND "parentRelation" IS NULL)
  OR ("parentId" IS NOT NULL AND "parentRelation" IN ('quantized', 'adapter', 'finetune'))
);
ALTER TABLE "model" ADD CONSTRAINT "model_not_own_parent_check" CHECK ("parentId" <> "id");
ALTER TABLE "document" ADD CONSTRAINT "document_kind_check" CHECK (
  "kind" IN ('system_card', 'technical_report', 'safety_report', 'blog')
);
