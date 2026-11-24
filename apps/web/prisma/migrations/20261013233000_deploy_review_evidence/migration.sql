-- AlterTable
ALTER TABLE "deploy_review" ADD COLUMN "evidence" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "deploy_review" ADD CONSTRAINT "deploy_review_evidence_check" CHECK ("evidence" IN ('full', 'no-quotes', 'counts-only'));
