-- AlterTable: the model that flagged the version's snippets. A version gets the flagger of its snippets.
ALTER TABLE "openaudit_card_version" ADD COLUMN "flagger" TEXT;
UPDATE "openaudit_card_version" v SET "flagger" = (
  SELECT s."flagger" FROM "openaudit_card_snippet" j JOIN "openaudit_snippet" s ON s."id" = j."snippetId"
  WHERE j."versionId" = v."id" LIMIT 1
);
