-- Only a private eval needs an owner. Anyone with the link can open an unlisted eval, so a
-- catalog eval can be unlisted to hide it.
ALTER TABLE "eval" DROP CONSTRAINT "eval_owner_check";
ALTER TABLE "eval" ADD CONSTRAINT "eval_owner_check" CHECK ("ownerUserId" IS NOT NULL OR "visibility" <> 'private');
