-- Which way of a reported number is better for safety, and which way shows more skill.
ALTER TABLE "eval_result" ADD COLUMN "safetyDirection" TEXT, ADD COLUMN "capabilityDirection" TEXT;
ALTER TABLE "eval_result" ADD CONSTRAINT "eval_result_direction_check" CHECK (
  ("safetyDirection" IS NULL OR "safetyDirection" IN ('higher_is_better', 'lower_is_better', 'neither'))
  AND ("capabilityDirection" IS NULL OR "capabilityDirection" IN ('higher_is_better', 'lower_is_better', 'neither'))
);
