-- A variant that is not public: left out of the lists; its page opens by link.
ALTER TABLE "method_variant" ADD COLUMN "visibility" TEXT NOT NULL DEFAULT 'public';
