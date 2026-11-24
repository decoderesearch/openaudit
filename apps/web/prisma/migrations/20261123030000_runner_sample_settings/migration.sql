-- The runner keeps each run's settings in the sample's `metadata` (`openaudit_runner/attempt_settings.py`).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'openaudit_runner') THEN
    GRANT UPDATE (metadata) ON "eval_sample" TO openaudit_runner;
  END IF;
END $$;
