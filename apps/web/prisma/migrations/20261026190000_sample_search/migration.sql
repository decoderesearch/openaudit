-- The words of each sample's text, for the search in the eval page's samples. The text is the input
-- of one of its attempts (an attempt keeps the first 2,000 characters). Readers who cannot read the
-- attempts get no text matches: the query checks it.
ALTER TABLE "eval_sample" ADD COLUMN "search" tsvector;

CREATE INDEX "eval_sample_search_idx" ON "eval_sample" USING GIN ("search");

-- Sets `search` on the samples of new attempts that have none yet. It runs as its owner: the
-- runner's role cannot update `eval_sample`.
CREATE FUNCTION eval_sample_search_from_attempts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE eval_sample s SET search = to_tsvector('english', n.input)
  FROM (
    SELECT DISTINCT ON ("evalSampleId") "evalSampleId" AS sid, input FROM added
    WHERE "evalSampleId" IS NOT NULL AND input IS NOT NULL
    ORDER BY "evalSampleId"
  ) n
  WHERE s.id = n.sid AND s.search IS NULL;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION eval_sample_search_from_attempts() FROM PUBLIC;

CREATE TRIGGER "eval_attempt_sample_search" AFTER INSERT ON "eval_attempt"
REFERENCING NEW TABLE AS added FOR EACH STATEMENT EXECUTE FUNCTION eval_sample_search_from_attempts();

UPDATE eval_sample s SET search = to_tsvector('english', n.input)
FROM (
  SELECT DISTINCT ON ("evalSampleId") "evalSampleId" AS sid, input FROM eval_attempt
  WHERE "evalSampleId" IS NOT NULL AND input IS NOT NULL
  ORDER BY "evalSampleId"
) n
WHERE s.id = n.sid;
