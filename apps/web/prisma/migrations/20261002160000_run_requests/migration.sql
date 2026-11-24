-- A user's run request waits as `requested` until an admin approves it.
ALTER TABLE "eval_run" ADD COLUMN "approvedById" UUID,
ADD COLUMN "approvedAt" TIMESTAMPTZ(3);

ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "eval_run_ownerUserId_status_idx" ON "eval_run"("ownerUserId", "status");
