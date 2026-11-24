-- AlterTable
ALTER TABLE "reply_summary" ADD COLUMN "uplift" TEXT,
ADD COLUMN "hazard" TEXT,
ADD CONSTRAINT "reply_summary_uplift_check" CHECK ("uplift" IS NULL OR "uplift" IN ('none', 'low', 'high')),
ADD CONSTRAINT "reply_summary_hazard_check" CHECK ("hazard" IS NULL OR "hazard" IN ('gated', 'restricted', 'withheld'));
