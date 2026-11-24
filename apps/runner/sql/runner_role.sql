-- The role of runner containers: it reads evals and models, and reads and writes runs, shards,
-- samples, attempts and results. It cannot read users, sessions or email. Safe to run again.
--
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -v runner_password="$PASSWORD" -f apps/runner/sql/runner_role.sql
--
-- Run it as the database owner, after migrations. Do not create the role in the Neon console:
-- console roles get neon_superuser.

SELECT set_config('openaudit.runner_password', :'runner_password', false) IS NOT NULL AS password_set;

DO $$
DECLARE
  pw text := current_setting('openaudit.runner_password');
BEGIN
  IF length(pw) < 24 THEN
    RAISE EXCEPTION 'Give a runner_password of 24 or more characters.';
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'openaudit_runner') THEN
    EXECUTE format('ALTER ROLE openaudit_runner WITH LOGIN PASSWORD %L', pw);
  ELSE
    EXECUTE format('CREATE ROLE openaudit_runner WITH LOGIN PASSWORD %L', pw);
  END IF;
END $$;

SELECT set_config('openaudit.runner_password', '', false) IS NOT NULL AS password_cleared;

-- A new role is not a superuser. Only a superuser can set that flag, so it is not here.
ALTER ROLE openaudit_runner WITH NOCREATEDB NOCREATEROLE CONNECTION LIMIT 100;

-- Remove all grants, then give only these.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM openaudit_runner;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM openaudit_runner;
REVOKE CREATE ON SCHEMA public FROM openaudit_runner;
GRANT USAGE ON SCHEMA public TO openaudit_runner;

GRANT SELECT ON eval, eval_version, model, runner_cap TO openaudit_runner;
GRANT SELECT, INSERT, UPDATE ON eval_run_shard TO openaudit_runner;
GRANT SELECT, INSERT, DELETE ON eval_attempt, eval_result TO openaudit_runner;
-- An import adds the samples that its attempts link (`openaudit_runner/samples.py`).
GRANT SELECT, INSERT ON eval_sample TO openaudit_runner;
-- It also keeps each run's settings in the sample's `metadata` (`openaudit_runner/attempt_settings.py`).
GRANT UPDATE (metadata) ON eval_sample TO openaudit_runner;
-- After an import, it sets the samples' fail counts again; the function runs as its owner.
GRANT EXECUTE ON FUNCTION refresh_sample_stats(uuid) TO openaudit_runner;
-- The flagger skips samples with a known error (EVAL_KNOWN_ERRORS.md).
GRANT SELECT ON eval_sample_issue TO openaudit_runner;

-- Runs are made by the web app. The runner changes only their progress and outcome.
GRANT SELECT ON eval_run TO openaudit_runner;
GRANT UPDATE (status, error, provenance, "logKey", "logBytes", "logSha256", "sampleCount",
  "attemptCount", "leaseOwner", "leaseExpiresAt", tries, "startedAt", "finishedAt", "updatedAt",
  "redactedKey", "redactedBytes", "redactedOmit")
  ON eval_run TO openaudit_runner;
