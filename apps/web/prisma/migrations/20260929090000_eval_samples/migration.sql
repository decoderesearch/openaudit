-- CreateTable
CREATE TABLE "eval_sample" (
    "id" UUID NOT NULL,
    "evalVersionId" UUID NOT NULL,
    "split" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "input" JSONB,
    "target" JSONB,
    "choices" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "eval_sample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eval_sample_evalVersionId_split_sourceId_key" ON "eval_sample"("evalVersionId", "split", "sourceId");

-- AddForeignKey
ALTER TABLE "eval_sample" ADD CONSTRAINT "eval_sample_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "eval_sample" ADD CONSTRAINT "eval_sample_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$');
