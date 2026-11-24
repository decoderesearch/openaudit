-- `toKey` is `inboxKey(to)` from lib/email/address.ts. Old rows get the lowercased address.
ALTER TABLE "email_log" ADD COLUMN "toKey" TEXT;
UPDATE "email_log" SET "toKey" = lower("to");
ALTER TABLE "email_log" ALTER COLUMN "toKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "email_log_toKey_type_sentAt_idx" ON "email_log"("toKey", "type", "sentAt");

-- CreateIndex
CREATE INDEX "email_log_type_sentAt_idx" ON "email_log"("type", "sentAt");
