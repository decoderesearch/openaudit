-- Each sample's graded and failed replies, for the "Most Failed" order of the eval page's samples.
ALTER TABLE "eval_sample" ADD COLUMN "graded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "failed" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "eval_sample_evalVersionId_failed_graded_id_idx" ON "eval_sample"("evalVersionId", "failed" DESC, "graded", "id");

-- Sets `graded` and `failed` on the samples of one eval version: one reply for each model and
-- epoch, from the model's newest public, succeeded run that is not a re-score. Returns the number
-- of samples that changed. The runner calls it after an import and prod sync after a copy; the
-- runner's role cannot update `eval_sample`, so the function runs as its owner.
CREATE FUNCTION refresh_sample_stats(version uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (x."evalSampleId", r."modelId", x.epoch) x."evalSampleId" AS sid, x.passed
    FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
    WHERE r."evalVersionId" = version AND r.status = 'succeeded' AND r.visibility = 'public'
      AND r.origin <> 'rescore' AND x."evalSampleId" IS NOT NULL AND x.passed IS NOT NULL
    ORDER BY x."evalSampleId", r."modelId", x.epoch, r."createdAt" DESC
  ), counts AS (
    SELECT s.id, count(l.sid)::int AS graded, count(l.sid) FILTER (WHERE NOT l.passed)::int AS failed
    FROM eval_sample s LEFT JOIN latest l ON l.sid = s.id
    WHERE s."evalVersionId" = version
    GROUP BY s.id
  ), changed AS (
    UPDATE eval_sample s SET graded = c.graded, failed = c.failed FROM counts c
    WHERE s.id = c.id AND (s.graded, s.failed) IS DISTINCT FROM (c.graded, c.failed)
    RETURNING 1
  )
  SELECT count(*)::int FROM changed;
$$;

REVOKE ALL ON FUNCTION refresh_sample_stats(uuid) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openaudit_runner') THEN
    GRANT EXECUTE ON FUNCTION refresh_sample_stats(uuid) TO openaudit_runner;
  END IF;
END $$;
