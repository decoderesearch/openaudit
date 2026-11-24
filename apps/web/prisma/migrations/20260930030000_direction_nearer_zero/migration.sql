-- A signed number where 0 is best, such as a signed bias score.
ALTER TABLE "eval_result" DROP CONSTRAINT "eval_result_direction_check";
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_direction_check" CHECK (
  ("safetyDirection" IS NULL OR "safetyDirection" IN ('higher_is_better', 'lower_is_better', 'nearer_zero_is_better', 'neither'))
  AND ("capabilityDirection" IS NULL OR "capabilityDirection" IN ('higher_is_better', 'lower_is_better', 'nearer_zero_is_better', 'neither'))
);
