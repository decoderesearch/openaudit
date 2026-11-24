-- Dataset terms on showing samples: the rule per eval version, a rule per attempt from a
-- subset rule, and the users who accepted the terms.
ALTER TABLE "eval_attempt" ADD COLUMN "display" TEXT;
ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_display_check" CHECK (
  "display" IS NULL OR "display" IN ('open', 'sign_in', 'scores_only')
);

ALTER TABLE "eval_version" ADD COLUMN "sampleTerms" JSONB;

CREATE TABLE "terms_acceptance" (
    "userId" UUID NOT NULL,
    "evalVersionId" UUID NOT NULL,
    "termsSha256" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "terms_acceptance_pkey" PRIMARY KEY ("userId","evalVersionId")
);

CREATE INDEX "terms_acceptance_evalVersionId_idx" ON "terms_acceptance"("evalVersionId");

ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "terms_acceptance" ADD CONSTRAINT "terms_acceptance_evalVersionId_fkey" FOREIGN KEY ("evalVersionId") REFERENCES "eval_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
