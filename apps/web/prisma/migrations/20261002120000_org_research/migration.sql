-- Research for organization pages: profile columns, incidents with timelines, departures,
-- investors and safety frameworks (data/seed/orgs/*.json).
ALTER TABLE "organization" ADD COLUMN "website" TEXT,
ADD COLUMN "summary" TEXT,
ADD COLUMN "researchedAt" DATE,
ADD COLUMN "researchDepth" TEXT;

-- CreateTable
CREATE TABLE "org_incident" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "endDate" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "categories" TEXT[],
    "primaryImpact" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "repercussions" TEXT NOT NULL,
    "resolution" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_incident_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "org_incident_severity_check" CHECK ("severity" IN ('red', 'orange', 'yellow'))
);

-- CreateTable
CREATE TABLE "org_incident_event" (
    "id" UUID NOT NULL,
    "incidentId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    "datePrecision" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "org_incident_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_departure" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "departedDate" TEXT,
    "datePrecision" TEXT,
    "kind" TEXT NOT NULL,
    "reason" TEXT,
    "quoteText" TEXT,
    "quoteUrl" TEXT,
    "imageUrl" TEXT,
    "imagePageUrl" TEXT,
    "imageLicense" TEXT,
    "imageAuthor" TEXT,
    "website" TEXT,
    "joinedDate" TEXT,
    "nextRole" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_departure_pkey" PRIMARY KEY ("id"),
    -- A quote has its URL; a photo has its page, license and author.
    CONSTRAINT "org_departure_quote_check" CHECK (("quoteText" IS NULL) = ("quoteUrl" IS NULL)),
    CONSTRAINT "org_departure_image_check" CHECK (
        ("imageUrl" IS NULL) = ("imagePageUrl" IS NULL)
        AND ("imageUrl" IS NULL) = ("imageLicense" IS NULL)
        AND ("imageUrl" IS NULL) = ("imageAuthor" IS NULL)
    )
);

-- CreateTable
CREATE TABLE "org_investor" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT,
    "notes" TEXT,
    "firstDate" TEXT,
    "datePrecision" TEXT,
    "sources" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_safety_framework" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "publishedDate" TEXT,
    "datePrecision" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_safety_framework_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "org_safety_framework_kind_check" CHECK ("kind" IN ('framework', 'commitment'))
);

-- CreateIndex
CREATE UNIQUE INDEX "org_incident_organizationId_slug_key" ON "org_incident"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "org_incident_event_incidentId_order_key" ON "org_incident_event"("incidentId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "org_departure_organizationId_name_key" ON "org_departure"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "org_investor_organizationId_name_key" ON "org_investor"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "org_safety_framework_organizationId_name_version_key" ON "org_safety_framework"("organizationId", "name", "version");

-- AddForeignKey
ALTER TABLE "org_incident" ADD CONSTRAINT "org_incident_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_incident_event" ADD CONSTRAINT "org_incident_event_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "org_incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_departure" ADD CONSTRAINT "org_departure_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_investor" ADD CONSTRAINT "org_investor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_safety_framework" ADD CONSTRAINT "org_safety_framework_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
