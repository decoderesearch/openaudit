-- CreateTable
CREATE TABLE "eval" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "aliases" TEXT[],
    "description" TEXT,
    "family" TEXT,
    "maintainers" JSONB NOT NULL DEFAULT '[]',
    "links" JSONB NOT NULL DEFAULT '[]',
    "access" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "measures" TEXT[],
    "formats" TEXT[],
    "cases" TEXT[],
    "grading" TEXT[],
    "adversarial" BOOLEAN NOT NULL,
    "humanParticipants" BOOLEAN NOT NULL,
    "subjects" TEXT[],
    "topics" TEXT[],
    "canary" TEXT,
    "ownerUserId" UUID,
    "visibility" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eval_version" (
    "id" UUID NOT NULL,
    "evalId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "releasedDate" TEXT,
    "changes" TEXT,
    "dataset" JSONB,
    "scores" JSONB NOT NULL DEFAULT '[]',
    "metrics" JSONB NOT NULL DEFAULT '[]',
    "runner" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "eval_slug_key" ON "eval"("slug");

-- CreateIndex
CREATE INDEX "eval_ownerUserId_idx" ON "eval"("ownerUserId");

-- CreateIndex
CREATE INDEX "eval_topics_idx" ON "eval" USING GIN ("topics");

-- CreateIndex
CREATE UNIQUE INDEX "eval_version_evalId_version_key" ON "eval_version"("evalId", "version");

-- AddForeignKey
ALTER TABLE "eval" ADD CONSTRAINT "eval_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eval_version" ADD CONSTRAINT "eval_version_evalId_fkey" FOREIGN KEY ("evalId") REFERENCES "eval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The spec's enums, and: an eval with no owner (the site registry) is public.
ALTER TABLE "eval" ADD CONSTRAINT "eval_enums_check" CHECK (
  "access" IN ('public', 'gated', 'held_out', 'lab_internal')
  AND "status" IN ('active', 'saturated', 'retired')
  AND "visibility" IN ('private', 'unlisted', 'public')
);
ALTER TABLE "eval" ADD CONSTRAINT "eval_owner_check" CHECK ("ownerUserId" IS NOT NULL OR "visibility" = 'public');

-- A published version has a publish time.
ALTER TABLE "eval_version" ADD CONSTRAINT "eval_version_status_check" CHECK (
  "status" IN ('draft', 'published') AND (("status" = 'published') = ("publishedAt" IS NOT NULL))
);
