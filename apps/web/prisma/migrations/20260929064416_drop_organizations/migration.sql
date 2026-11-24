-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviterId_fkey";

-- DropForeignKey
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "member" DROP CONSTRAINT "member_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "member" DROP CONSTRAINT "member_userId_fkey";

-- AlterTable
ALTER TABLE "session" DROP COLUMN "activeOrganizationId";

-- DropTable
DROP TABLE "invitation";

-- DropTable
DROP TABLE "member";

-- DropTable
DROP TABLE "organization";

