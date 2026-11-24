-- AlterTable: an event that exists now gets its incident's time, so it is not new.
ALTER TABLE "org_incident_event" ADD COLUMN "createdAt" TIMESTAMPTZ(3);
UPDATE "org_incident_event" e SET "createdAt" = i."createdAt" FROM "org_incident" i WHERE i."id" = e."incidentId";
ALTER TABLE "org_incident_event" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "createdAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "update_digest" (
    "id" UUID NOT NULL,
    "day" TEXT NOT NULL,
    "since" TIMESTAMPTZ(3) NOT NULL,
    "until" TIMESTAMPTZ(3) NOT NULL,
    "counts" JSONB NOT NULL DEFAULT '{}',
    "broadcasts" JSONB NOT NULL DEFAULT '{}',
    "items" JSONB NOT NULL DEFAULT '[]',
    "error" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "update_digest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "update_digest_day_key" ON "update_digest"("day");
