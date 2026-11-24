-- Known errors in eval samples (EVAL_KNOWN_ERRORS.md): one row for each sample. A confirmed issue
-- with effect `exclude` takes the sample out of the eval page's pass rates and failed counts.
CREATE TABLE "eval_sample_issue" (
    "id" UUID NOT NULL,
    "evalSampleId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "effect" TEXT NOT NULL DEFAULT 'exclude',
    "note" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_sample_issue_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eval_sample_issue_kind_check" CHECK ("kind" IN ('label_error', 'missing_context', 'prompt_conflict', 'grader_error', 'other')),
    CONSTRAINT "eval_sample_issue_status_check" CHECK ("status" IN ('proposed', 'confirmed', 'rejected')),
    CONSTRAINT "eval_sample_issue_effect_check" CHECK ("effect" IN ('exclude', 'note')),
    CONSTRAINT "eval_sample_issue_source_check" CHECK ("source" IN ('llm_review', 'staff', 'report', 'upstream'))
);

CREATE UNIQUE INDEX "eval_sample_issue_evalSampleId_key" ON "eval_sample_issue"("evalSampleId");
CREATE INDEX "eval_sample_issue_status_effect_idx" ON "eval_sample_issue"("status", "effect");

ALTER TABLE "eval_sample_issue" ADD CONSTRAINT "eval_sample_issue_evalSampleId_fkey" FOREIGN KEY ("evalSampleId") REFERENCES "eval_sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- As before, but a sample with a confirmed `exclude` issue counts no failed replies.
CREATE OR REPLACE FUNCTION refresh_sample_stats(version uuid) RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH latest AS (
    SELECT DISTINCT ON (x."evalSampleId", r."modelId", x.epoch) x."evalSampleId" AS sid, x.passed
    FROM eval_attempt x JOIN eval_run r ON r.id = x."runId"
    WHERE r."evalVersionId" = version AND r.status = 'succeeded' AND r.visibility = 'public'
      AND r.origin <> 'rescore' AND x."evalSampleId" IS NOT NULL AND x.passed IS NOT NULL
    ORDER BY x."evalSampleId", r."modelId", x.epoch, r."createdAt" DESC
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

-- The runner's flagger skips the attempts of excluded samples.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openaudit_runner') THEN
    GRANT SELECT ON "eval_sample_issue" TO openaudit_runner;
  END IF;
END $$;
