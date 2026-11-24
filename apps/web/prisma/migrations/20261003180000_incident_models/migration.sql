-- AlterTable
ALTER TABLE "org_incident" ADD COLUMN     "modelIds" UUID[] DEFAULT ARRAY[]::UUID[];

-- CreateIndex
CREATE INDEX "org_incident_modelIds_idx" ON "org_incident" USING GIN ("modelIds");
