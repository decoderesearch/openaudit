-- Deploymeter: the anonymous evidence packets, the AI panel runs and their reviews, and people's reviews.
-- CreateTable
CREATE TABLE "deploy_packet" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "cardVersionId" UUID NOT NULL,
    "inputSha256" TEXT NOT NULL,
    "scrubVersion" TEXT NOT NULL,
    "scrubber" TEXT,
    "content" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "leaks" JSONB NOT NULL DEFAULT '[]',
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deploy_packet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploy_panel" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "packetId" UUID NOT NULL,
    "cardVersionId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedAt" TIMESTAMPTZ(3),
    "promptVersion" TEXT NOT NULL,
    "judges" TEXT[],
    "meter" INTEGER,
    "summary" JSONB,
    "summarizer" TEXT,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deploy_panel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploy_review" (
    "id" UUID NOT NULL,
    "panelId" UUID NOT NULL,
    "judge" TEXT NOT NULL,
    "openWeights" BOOLEAN NOT NULL,
    "sameLab" BOOLEAN NOT NULL,
    "self" BOOLEAN NOT NULL,
    "score" INTEGER,
    "enoughEvidence" BOOLEAN,
    "headline" TEXT,
    "summary" TEXT,
    "reasonsFor" TEXT[],
    "reasonsAgainst" TEXT[],
    "samples" JSONB NOT NULL DEFAULT '[]',
    "guess" JSONB,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deploy_review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploy_human_review" (
    "id" UUID NOT NULL,
    "modelId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "cardVersionId" UUID,
    "score" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "deploy_human_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "deploy_packet_modelId_inputSha256_key" ON "deploy_packet"("modelId", "inputSha256");

-- CreateIndex
CREATE INDEX "deploy_panel_modelId_status_idx" ON "deploy_panel"("modelId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "deploy_panel_modelId_number_key" ON "deploy_panel"("modelId", "number");

-- CreateIndex
CREATE INDEX "deploy_review_judge_idx" ON "deploy_review"("judge");

-- CreateIndex
CREATE UNIQUE INDEX "deploy_review_panelId_judge_key" ON "deploy_review"("panelId", "judge");

-- CreateIndex
CREATE INDEX "deploy_human_review_modelId_idx" ON "deploy_human_review"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "deploy_human_review_userId_modelId_key" ON "deploy_human_review"("userId", "modelId");

-- AddForeignKey
ALTER TABLE "deploy_packet" ADD CONSTRAINT "deploy_packet_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_packet" ADD CONSTRAINT "deploy_packet_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "openaudit_card_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_panel" ADD CONSTRAINT "deploy_panel_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_panel" ADD CONSTRAINT "deploy_panel_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "deploy_packet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_panel" ADD CONSTRAINT "deploy_panel_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "openaudit_card_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_review" ADD CONSTRAINT "deploy_review_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "deploy_panel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_human_review" ADD CONSTRAINT "deploy_human_review_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_human_review" ADD CONSTRAINT "deploy_human_review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploy_human_review" ADD CONSTRAINT "deploy_human_review_cardVersionId_fkey" FOREIGN KEY ("cardVersionId") REFERENCES "openaudit_card_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deploy_panel" ADD CONSTRAINT "deploy_panel_status_check" CHECK ("status" IN ('draft', 'published', 'discarded'));
ALTER TABLE "deploy_panel" ADD CONSTRAINT "deploy_panel_meter_check" CHECK ("meter" BETWEEN 0 AND 100);
ALTER TABLE "deploy_review" ADD CONSTRAINT "deploy_review_score_check" CHECK ("score" BETWEEN 0 AND 100);
ALTER TABLE "deploy_human_review" ADD CONSTRAINT "deploy_human_review_score_check" CHECK ("score" BETWEEN 0 AND 100);
