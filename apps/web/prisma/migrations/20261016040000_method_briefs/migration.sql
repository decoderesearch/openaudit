-- AlterTable
ALTER TABLE "method_family" ADD COLUMN "brief" JSONB;

-- AlterTable
ALTER TABLE "method" ADD COLUMN "brief" JSONB;

-- CreateTable
CREATE TABLE "method_expert_view" (
    "id" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "methodIds" UUID[] DEFAULT ARRAY[]::UUID[],
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

-- CreateIndex
CREATE UNIQUE INDEX "method_expert_view_familyId_slug_key" ON "method_expert_view"("familyId", "slug");

-- AddForeignKey
ALTER TABLE "method_expert_view" ADD CONSTRAINT "method_expert_view_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "method_family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
