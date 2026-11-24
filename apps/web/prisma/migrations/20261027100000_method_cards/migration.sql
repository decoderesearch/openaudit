-- Method cards: the executive summary of a method or a variant, in versions (draft | published | discarded).

-- CreateTable
CREATE TABLE "method_card" (
    "id" UUID NOT NULL,
    "methodId" UUID NOT NULL,
    "variantId" UUID,
    "builtAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_card_version" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewedAt" TIMESTAMPTZ(3),
    "aggregator" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "inputSha256" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "tokens" JSONB NOT NULL DEFAULT '{}',
    "brief" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "method_card_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "method_card_variantId_key" ON "method_card"("variantId");

-- CreateIndex
CREATE INDEX "method_card_methodId_idx" ON "method_card"("methodId");

-- CreateIndex
CREATE INDEX "method_card_version_cardId_status_idx" ON "method_card_version"("cardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "method_card_version_cardId_number_key" ON "method_card_version"("cardId", "number");

-- AddForeignKey
ALTER TABLE "method_card" ADD CONSTRAINT "method_card_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "method"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_card" ADD CONSTRAINT "method_card_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "method_variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_card_version" ADD CONSTRAINT "method_card_version_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "method_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One card for each method: a card with no variant is the method's own.
CREATE UNIQUE INDEX "method_card_method_only_key" ON "method_card"("methodId") WHERE "variantId" IS NULL;
