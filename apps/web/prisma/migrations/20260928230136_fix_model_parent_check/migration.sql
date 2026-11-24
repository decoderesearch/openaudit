-- Both or neither. A CHECK passes on NULL, so the old `IN` test let a parent with no relation through.
ALTER TABLE "model" DROP CONSTRAINT "model_parent_check";
ALTER TABLE "model" ADD CONSTRAINT "model_parent_check" CHECK (
  ("parentId" IS NULL) = ("parentRelation" IS NULL)
  AND ("parentRelation" IS NULL OR "parentRelation" IN ('quantized', 'adapter', 'finetune'))
);
