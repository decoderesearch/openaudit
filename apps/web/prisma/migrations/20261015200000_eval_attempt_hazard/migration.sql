-- AlterTable
ALTER TABLE "eval_attempt" ADD COLUMN "hazard" TEXT;
ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_hazard_check" CHECK (
  "hazard" IS NULL OR "hazard" IN ('gated', 'restricted', 'withheld')
);
