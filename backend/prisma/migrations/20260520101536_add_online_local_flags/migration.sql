-- AlterTable
ALTER TABLE "MemberPlan" ADD COLUMN     "localModelEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlineApiEnabled" BOOLEAN NOT NULL DEFAULT false;
