-- The category or group metrics that count each attempt. The runner fills it.
ALTER TABLE "eval_attempt" ADD COLUMN "metrics" TEXT[] DEFAULT ARRAY[]::TEXT[];
