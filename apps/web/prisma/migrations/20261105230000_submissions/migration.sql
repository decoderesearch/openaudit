-- Submissions from the navbar's Submit form, with a public number ("SUB-<number>") and a status.
CREATE TABLE "submission" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "body" TEXT NOT NULL,
    "email" TEXT,
    "page" TEXT,
    "fields" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "submission_type_check" CHECK ("type" IN ('incident', 'evaluation', 'method', 'other')),
    CONSTRAINT "submission_status_check" CHECK ("status" IN ('received', 'reviewing', 'accepted', 'declined'))
);

CREATE UNIQUE INDEX "submission_number_key" ON "submission"("number");

CREATE INDEX "submission_status_createdAt_idx" ON "submission"("status", "createdAt");
