-- 1. VideoTask 加 idempotency_key 唯一索引
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "VideoTask_idempotencyKey_key" ON "VideoTask"("idempotencyKey") WHERE "idempotencyKey" IS NOT NULL;

-- 2. VideoTask 加 heartbeat_at + locked_by
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMP;
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;

-- 3. VideoTask 加 retry_count + max_retries
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "maxRetries" INTEGER NOT NULL DEFAULT 3;

-- 4. VideoTask 加 completed_at
ALTER TABLE "VideoTask" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP;

-- 5. TaskLog 加 event_id (用于 SSE replay)
ALTER TABLE "TaskLog" ADD COLUMN IF NOT EXISTS "eventId" TEXT;
CREATE INDEX IF NOT EXISTS "TaskLog_taskId_eventId_idx" ON "TaskLog"("taskId", "eventId");

-- 6. Asset 加 taskId 关联 + 唯一约束 (防止重复生成)
ALTER TABLE "Asset" ADD COLUMN IF NOT EXISTS "taskId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Asset_taskId_type_key" ON "Asset"("taskId", "type") WHERE "taskId" IS NOT NULL;
