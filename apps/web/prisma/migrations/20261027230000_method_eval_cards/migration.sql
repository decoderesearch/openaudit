-- Method eval cards: Results Summary and Caveats of a method eval or a suite, in versions (draft | published | discarded).

-- CreateTable
CREATE TABLE "method_eval_card" (
    "id" UUID NOT NULL,
    "evalId" UUID,
    "suiteId" UUID,
    "builtAt" TIMESTAMPTZ(3),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "method_eval_card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "method_eval_card_version" (
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

    CONSTRAINT "method_eval_card_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "method_eval_card_evalId_key" ON "method_eval_card"("evalId");

-- CreateIndex
CREATE UNIQUE INDEX "method_eval_card_suiteId_key" ON "method_eval_card"("suiteId");

-- CreateIndex
CREATE INDEX "method_eval_card_version_cardId_status_idx" ON "method_eval_card_version"("cardId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "method_eval_card_version_cardId_number_key" ON "method_eval_card_version"("cardId", "number");

-- AddForeignKey
ALTER TABLE "method_eval_card" ADD CONSTRAINT "method_eval_card_evalId_fkey" FOREIGN KEY ("evalId") REFERENCES "eval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_eval_card" ADD CONSTRAINT "method_eval_card_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES "eval_suite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "method_eval_card_version" ADD CONSTRAINT "method_eval_card_version_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "method_eval_card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A card is of one eval or of one suite.
ALTER TABLE "method_eval_card" ADD CONSTRAINT "method_eval_card_one_subject" CHECK (("evalId" IS NULL) <> ("suiteId" IS NULL));
