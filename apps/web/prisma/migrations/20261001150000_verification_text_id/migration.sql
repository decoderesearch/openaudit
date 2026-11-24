-- Better Auth writes its own ids (not UUIDs) here, for example the lock row of an unverified user's
-- magic-link sign-in.
ALTER TABLE "verification" ALTER COLUMN "id" TYPE TEXT;
