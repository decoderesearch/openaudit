-- One payment for many runs (the "run all recommended" bundle): each run points to the payment.
ALTER TABLE "eval_run" ADD COLUMN "bundlePaymentId" UUID;

CREATE INDEX "eval_run_bundlePaymentId_idx" ON "eval_run"("bundlePaymentId");

ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_bundlePaymentId_fkey" FOREIGN KEY ("bundlePaymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
