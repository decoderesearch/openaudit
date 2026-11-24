-- A user's request of a cheap eval starts without an admin's approval.
ALTER TABLE "eval" ADD COLUMN "autoApprove" BOOLEAN NOT NULL DEFAULT false;
