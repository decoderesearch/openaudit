-- AlterTable: the versions that exist now are published; new versions are drafts.
ALTER TABLE "openaudit_card_version" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'published',
ADD COLUMN     "reviewedAt" TIMESTAMPTZ(3),
ADD COLUMN     "emailedAt" TIMESTAMPTZ(3);
ALTER TABLE "openaudit_card_version" ALTER COLUMN "status" SET DEFAULT 'draft';

-- CreateIndex
CREATE INDEX "openaudit_card_version_cardId_status_idx" ON "openaudit_card_version"("cardId", "status");
