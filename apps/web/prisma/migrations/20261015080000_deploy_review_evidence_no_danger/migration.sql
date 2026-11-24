-- AlterTable
ALTER TABLE "deploy_review" DROP CONSTRAINT "deploy_review_evidence_check";
ALTER TABLE "deploy_review" ADD CONSTRAINT "deploy_review_evidence_check" CHECK ("evidence" IN ('full', 'no-danger', 'no-quotes', 'counts-only'));
