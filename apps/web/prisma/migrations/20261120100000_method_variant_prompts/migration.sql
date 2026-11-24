-- The prompts of a variant that is an LLM, as the judge prompt of a monitor.
ALTER TABLE "method_variant" ADD COLUMN "prompts" JSONB NOT NULL DEFAULT '[]';
