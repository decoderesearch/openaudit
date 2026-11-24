-- AlterTable
ALTER TABLE "reply_summary" ADD COLUMN "domain" TEXT,
ADD COLUMN "fiction" BOOLEAN,
ADD CONSTRAINT "reply_summary_domain_check" CHECK ("domain" IS NULL OR "domain" IN ('cbrn', 'weapons', 'cyber', 'violence', 'other'));
