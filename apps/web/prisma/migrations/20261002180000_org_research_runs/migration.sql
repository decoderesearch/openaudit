-- CreateTable
CREATE TABLE "org_research_prompt" (
    "id" UUID NOT NULL,
    "sha256" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_research_prompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_research_run" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "model" TEXT NOT NULL,
    "promptId" UUID NOT NULL,
    "task" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "org_research_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_research_prompt_sha256_key" ON "org_research_prompt"("sha256");

-- CreateIndex
CREATE INDEX "org_research_run_promptId_idx" ON "org_research_run"("promptId");

-- CreateIndex
CREATE UNIQUE INDEX "org_research_run_organizationId_date_model_promptId_key" ON "org_research_run"("organizationId", "date", "model", "promptId");

-- AddForeignKey
ALTER TABLE "org_research_run" ADD CONSTRAINT "org_research_run_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_research_run" ADD CONSTRAINT "org_research_run_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "org_research_prompt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

