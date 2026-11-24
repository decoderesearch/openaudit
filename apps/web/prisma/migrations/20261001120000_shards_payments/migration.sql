-- Runs split into shards that runners claim; site-wide caps on parallel model calls; Stripe
-- payments for runs; one email of each type per run.
CREATE TABLE "eval_run_shard" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "sampleStart" INTEGER NOT NULL,
    "sampleEnd" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "connections" INTEGER NOT NULL,
    "capKey" TEXT NOT NULL,
    "logKey" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "tries" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "eval_run_shard_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "eval_run_shard_status_check" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    CONSTRAINT "eval_run_shard_range_check" CHECK ("sampleStart" >= 0 AND "sampleEnd" > "sampleStart"),
    CONSTRAINT "eval_run_shard_connections_check" CHECK ("connections" >= 1)
);

CREATE UNIQUE INDEX "eval_run_shard_runId_ordinal_key" ON "eval_run_shard"("runId", "ordinal");
CREATE INDEX "eval_run_shard_status_createdAt_idx" ON "eval_run_shard"("status", "createdAt");
CREATE INDEX "eval_run_shard_capKey_status_idx" ON "eval_run_shard"("capKey", "status");

ALTER TABLE "eval_run_shard" ADD CONSTRAINT "eval_run_shard_runId_fkey" FOREIGN KEY ("runId") REFERENCES "eval_run"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "runner_cap" (
    "key" TEXT NOT NULL,
    "maxConnections" INTEGER NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_cap_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "runner_cap_max_check" CHECK ("maxConnections" >= 1)
);

INSERT INTO "runner_cap" ("key", "maxConnections") VALUES ('openrouter', 200);

CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "runId" UUID,
    "stripeSessionId" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "email" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "method" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "quote" JSONB NOT NULL,
    "receiptUrl" TEXT,
    "paidAt" TIMESTAMPTZ(3),
    "refundedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_status_check" CHECK ("status" IN ('pending', 'paid', 'refunded', 'failed', 'expired')),
    CONSTRAINT "payment_amount_check" CHECK ("amountCents" >= 0)
);

CREATE UNIQUE INDEX "payment_runId_key" ON "payment"("runId");
CREATE UNIQUE INDEX "payment_stripeSessionId_key" ON "payment"("stripeSessionId");
CREATE INDEX "payment_userId_createdAt_idx" ON "payment"("userId", "createdAt");

ALTER TABLE "payment" ADD CONSTRAINT "payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_runId_fkey" FOREIGN KEY ("runId") REFERENCES "eval_run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "email_log" ADD COLUMN "runId" UUID;
CREATE UNIQUE INDEX "email_log_runId_type_key" ON "email_log"("runId", "type");
