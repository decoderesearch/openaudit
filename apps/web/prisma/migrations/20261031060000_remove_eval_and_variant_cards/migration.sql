-- Method eval cards and variant cards are gone. Only method cards stay, one for each method.

-- The variant cards and their versions (the versions go by ON DELETE CASCADE).
DELETE FROM "method_card" WHERE "variantId" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "method_card" DROP CONSTRAINT "method_card_variantId_fkey";

-- DropForeignKey
ALTER TABLE "method_eval_card" DROP CONSTRAINT "method_eval_card_evalId_fkey";

-- DropForeignKey
ALTER TABLE "method_eval_card" DROP CONSTRAINT "method_eval_card_suiteId_fkey";

-- DropForeignKey
ALTER TABLE "method_eval_card_version" DROP CONSTRAINT "method_eval_card_version_cardId_fkey";

-- DropIndex
DROP INDEX "method_card_variantId_key";

-- DropIndex
DROP INDEX "method_card_methodId_idx";

-- DropIndex
DROP INDEX "method_card_method_only_key";

-- AlterTable
ALTER TABLE "method_card" DROP COLUMN "variantId";

-- DropTable
DROP TABLE "method_eval_card";

-- DropTable
DROP TABLE "method_eval_card_version";

-- CreateIndex
CREATE UNIQUE INDEX "method_card_methodId_key" ON "method_card"("methodId");
