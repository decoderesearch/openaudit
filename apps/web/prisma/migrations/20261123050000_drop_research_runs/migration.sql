-- Research runs and eval.statusReason are gone. Nothing reads them.
DROP TABLE IF EXISTS "org_research_run";
DROP TABLE IF EXISTS "org_research_prompt";
ALTER TABLE "eval" DROP COLUMN IF EXISTS "statusReason";
