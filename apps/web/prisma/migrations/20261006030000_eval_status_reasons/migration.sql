-- A reason and a decision day (YYYY-MM-DD) for each of `saturated` and `legacy`.
ALTER TABLE "eval" ADD COLUMN "saturatedReason" TEXT,
ADD COLUMN "saturatedDecisionDate" TEXT,
ADD COLUMN "legacyReason" TEXT,
ADD COLUMN "legacyDecisionDate" TEXT;

UPDATE "eval" SET "saturatedReason" = "statusReason" WHERE "status" = 'saturated';
UPDATE "eval" SET "legacyReason" = "statusReason" WHERE "status" = 'legacy';
