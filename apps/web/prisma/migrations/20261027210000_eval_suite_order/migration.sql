-- The display order of a suite's evals.

-- AlterTable
ALTER TABLE "eval_suite" ADD COLUMN     "evalOrder" TEXT[];
