-- A re-score replaces its source run in the sample counts: the same replies, graded by the newer
-- judges. Each model counts with its newest replies (a re-score has its source's age), then its
-- newest grades.
CREATE OR REPLACE FUNCTION refresh_sample_stats(version uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (x."evalSampleId", r."modelId", x.epoch) x."evalSampleId" AS sid, x.passed
    FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
    LEFT JOIN eval_run src ON src.id = r."sourceRunId"
    WHERE r."evalVersionId" = version AND r.status = 'succeeded' AND r.visibility = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM eval_run q
        WHERE q."sourceRunId" = r.id AND q.status = 'succeeded' AND q.visibility = 'public'
      )
      AND x."evalSampleId" IS NOT NULL AND x.passed IS NOT NULL
    ORDER BY x."evalSampleId", r."modelId", x.epoch, COALESCE(src."createdAt", r."createdAt") DESC, r."createdAt" DESC
  ), counts AS (
    SELECT s.id, count(l.sid)::int AS graded,
      CASE WHEN bool_or(i.id IS NOT NULL) THEN 0 ELSE count(l.sid) FILTER (WHERE NOT l.passed) END::int AS failed
    FROM eval_sample s LEFT JOIN latest l ON l.sid = s.id
    LEFT JOIN eval_sample_issue i ON i."evalSampleId" = s.id AND i.status = 'confirmed' AND i.effect = 'exclude'
    WHERE s."evalVersionId" = version
    GROUP BY s.id
  ), changed AS (
    UPDATE eval_sample s SET graded = c.graded, failed = c.failed FROM counts c
    WHERE s.id = c.id AND (s.graded, s.failed) IS DISTINCT FROM (c.graded, c.failed)
    RETURNING 1
  )
  SELECT count(*)::int FROM changed;
$$;

SELECT refresh_sample_stats(id) FROM eval_version;
