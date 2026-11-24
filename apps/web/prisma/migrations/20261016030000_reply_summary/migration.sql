-- CreateTable
CREATE TABLE "reply_summary" (
    "attemptId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "costUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reply_summary_pkey" PRIMARY KEY ("attemptId")
);

