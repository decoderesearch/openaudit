-- Method cards are gone. The seed now gives each method its expert summary.

-- DropTable
DROP TABLE "method_card_version";

-- DropTable
DROP TABLE "method_card";

-- AlterTable
ALTER TABLE "method" DROP COLUMN "brief",
ADD COLUMN "expertSummary" TEXT;

-- AlterTable
ALTER TABLE "method_variant" DROP COLUMN "brief";
