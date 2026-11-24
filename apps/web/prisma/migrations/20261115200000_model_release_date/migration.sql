-- The model's release date from its facts, so lists need not read `facts`.
ALTER TABLE "model" ADD COLUMN "releaseDate" TEXT;

UPDATE "model" SET "releaseDate" = facts->'releaseDate'->>'value'
WHERE jsonb_typeof(facts->'releaseDate'->'value') = 'string';
