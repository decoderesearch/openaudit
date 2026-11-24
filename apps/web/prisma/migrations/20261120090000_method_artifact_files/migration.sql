-- The files of an artifact to download: the source URL at a commit, and our copy in R2.
ALTER TABLE "method_artifact" ADD COLUMN "files" JSONB NOT NULL DEFAULT '[]';
