-- Safety commitments: each kind of commitment, each organization's state for it, and its timeline.
CREATE TABLE "commitment" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "commitment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "commitment_category_check" CHECK ("category" IN ('oversight', 'transparency', 'limits', 'security'))
);

CREATE TABLE "org_commitment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "commitmentId" UUID NOT NULL,
    "checkedAt" DATE NOT NULL,
    "summary" TEXT,
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_commitment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "org_commitment_event" (
    "id" UUID NOT NULL,
    "orgCommitmentId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "quoteText" TEXT,
    "quoteUrl" TEXT,
    "agreement" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "state" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_commitment_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "org_commitment_event_kind_check" CHECK ("kind" IN ('announced', 'expanded', 'narrowed', 'renewed', 'expired', 'withdrawn', 'broken', 'kept', 'declined'))
);

CREATE UNIQUE INDEX "commitment_slug_key" ON "commitment"("slug");
CREATE INDEX "org_commitment_commitmentId_idx" ON "org_commitment"("commitmentId");
CREATE UNIQUE INDEX "org_commitment_organizationId_commitmentId_key" ON "org_commitment"("organizationId", "commitmentId");
CREATE UNIQUE INDEX "org_commitment_event_orgCommitmentId_order_key" ON "org_commitment_event"("orgCommitmentId", "order");

ALTER TABLE "org_commitment" ADD CONSTRAINT "org_commitment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_commitment" ADD CONSTRAINT "org_commitment_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "org_commitment_event" ADD CONSTRAINT "org_commitment_event_orgCommitmentId_fkey" FOREIGN KEY ("orgCommitmentId") REFERENCES "org_commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
