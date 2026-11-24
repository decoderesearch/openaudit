-- Paid runs through Stripe are gone. Production had no payments.
ALTER TABLE "eval_run" DROP CONSTRAINT IF EXISTS "eval_run_bundlePaymentId_fkey";
DROP INDEX IF EXISTS "eval_run_bundlePaymentId_idx";
ALTER TABLE "eval_run" DROP COLUMN IF EXISTS "bundlePaymentId";
DROP TABLE IF EXISTS "payment";
