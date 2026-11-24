-- A Deploymeter judge can abstain: no score, not in the meter.

-- AlterTable
ALTER TABLE "deploy_review" ADD COLUMN "abstain" BOOLEAN NOT NULL DEFAULT false;
