-- Eval status `legacy` (still runnable, not recommended), with a one-line reason and the newer eval.
ALTER TABLE "eval" ADD COLUMN "statusReason" TEXT,
ADD COLUMN "supersededBy" TEXT;

ALTER TABLE "eval" DROP CONSTRAINT "eval_enums_check";
ALTER TABLE "eval" ADD CONSTRAINT "eval_enums_check" CHECK (
  "access" IN ('public', 'gated', 'held_out', 'lab_internal')
  AND "status" IN ('active', 'saturated', 'legacy', 'retired')
  AND "visibility" IN ('private', 'unlisted', 'public')
);
