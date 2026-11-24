-- A hidden model: only admins see it, its page and its runs.
ALTER TABLE "model" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
