-- Eval suites: a set of evals with one page (SAEBench). An eval names its suite.

-- AlterTable
ALTER TABLE "eval" ADD COLUMN     "suiteId" UUID;

-- CreateTable
CREATE TABLE "eval_suite" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "maintainers" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "matched" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_suite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eval_suite_slug_key" ON "eval_suite"("slug");

-- CreateIndex
CREATE INDEX "eval_suiteId_idx" ON "eval"("suiteId");

-- AddForeignKey
ALTER TABLE "eval" ADD CONSTRAINT "eval_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "eval_suite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
