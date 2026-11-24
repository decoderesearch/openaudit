-- Developer is now Organization. Rename in place, so rows and ids stay.
ALTER TABLE "developer" RENAME TO "organization";
ALTER TABLE "organization" RENAME CONSTRAINT "developer_pkey" TO "organization_pkey";
ALTER INDEX "developer_slug_key" RENAME TO "organization_slug_key";

ALTER TABLE "model" RENAME COLUMN "developerId" TO "organizationId";
ALTER INDEX "model_developerId_idx" RENAME TO "model_organizationId_idx";
ALTER TABLE "model" RENAME CONSTRAINT "model_developerId_fkey" TO "model_organizationId_fkey";

-- Other slugs that redirect to the organization's page.
ALTER TABLE "organization" ADD COLUMN "slugAliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
CREATE INDEX "organization_slugAliases_idx" ON "organization" USING GIN ("slugAliases");

-- `EvalMaintainer.developerId` is now `organizationId`.
UPDATE "eval" SET "maintainers" = (
  SELECT jsonb_agg(
    CASE WHEN m ? 'developerId'
      THEN (m - 'developerId') || jsonb_build_object('organizationId', m -> 'developerId')
      ELSE m END
    ORDER BY i)
  FROM jsonb_array_elements("maintainers") WITH ORDINALITY AS t(m, i)
)
WHERE jsonb_path_exists("maintainers", '$[*].developerId');

-- Cheaper judge or helper models for an eval, with the date and the evidence.
ALTER TABLE "eval" ADD COLUMN "recommendedModels" JSONB NOT NULL DEFAULT '[]';
