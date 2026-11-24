-- The public copy of a run's log, and the attempts that it leaves out. The runner fills them.
ALTER TABLE "eval_run" ADD COLUMN "redactedKey" TEXT;
ALTER TABLE "eval_run" ADD COLUMN "redactedBytes" INTEGER;
ALTER TABLE "eval_run" ADD COLUMN "redactedOmit" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
