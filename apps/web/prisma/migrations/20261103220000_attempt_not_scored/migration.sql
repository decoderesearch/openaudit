-- Why an attempt has no scores, from the sample's metadata. The sample panel read it from each
-- transcript in R2, which was slow.
ALTER TABLE "eval_attempt" ADD COLUMN "notScored" TEXT;
