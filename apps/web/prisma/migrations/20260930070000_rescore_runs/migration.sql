-- A re-score run points to the run whose outputs it scores again.
-- AlterTable
ALTER TABLE "eval_run" ADD COLUMN     "sourceRunId" UUID;

-- CreateIndex
CREATE INDEX "eval_run_sourceRunId_idx" ON "eval_run"("sourceRunId");

-- AddForeignKey
ALTER TABLE "eval_run" ADD CONSTRAINT "eval_run_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "eval_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
