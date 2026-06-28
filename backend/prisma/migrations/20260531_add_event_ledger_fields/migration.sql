-- CreateIndex
CREATE INDEX "InvocationLog_executionId_idx" ON "InvocationLog"("executionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_wechatOpenId_key" ON "User"("wechatOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "User_qqOpenId_key" ON "User"("qqOpenId");

