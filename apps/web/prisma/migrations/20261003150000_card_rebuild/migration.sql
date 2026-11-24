-- AlterTable
ALTER TABLE "openaudit_card" ADD COLUMN     "rebuildAt" TIMESTAMPTZ(3),
ADD COLUMN     "rebuildForce" BOOLEAN NOT NULL DEFAULT false;
