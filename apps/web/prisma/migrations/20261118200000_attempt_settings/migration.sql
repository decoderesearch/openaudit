-- The run's settings as each attempt keeps them (`openaudit_runner/attempt_settings.py`).
ALTER TABLE "eval_attempt" ADD COLUMN "settings" JSONB;
