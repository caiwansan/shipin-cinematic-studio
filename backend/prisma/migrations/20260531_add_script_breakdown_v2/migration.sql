-- AlterTable
ALTER TABLE "ScriptBreakdown" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InvocationLog_executionId_idx" ON "InvocationLog"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "User_qqOpenId_key" ON "User"("qqOpenId");

-- RenameIndex
ALTER INDEX "idx_script_breakdown_project" RENAME TO "ScriptBreakdown_projectId_idx";

-- RenameIndex
ALTER INDEX "idx_script_breakdown_user" RENAME TO "ScriptBreakdown_userId_idx";

