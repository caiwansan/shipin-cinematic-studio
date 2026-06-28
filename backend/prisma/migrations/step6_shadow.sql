-- STEP 6: Shadow Mode + Production Release Layer
-- 旁路系统，不污染主链路

-- ============================================================
-- 1. Shadow Config（影子执行配置 / 灰度控制）
-- ============================================================
CREATE TABLE IF NOT EXISTS "ShadowConfig" (
  "id" TEXT PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "grayThreshold" INTEGER NOT NULL DEFAULT 0,  -- 0-100, 灰度百分比
  "maxConcurrent" INTEGER NOT NULL DEFAULT 5,  -- 影子执行最大并发
  "rateLimitPerMin" INTEGER NOT NULL DEFAULT 10, -- 每分钟限流
  "costBudget" DECIMAL(12,6) NOT NULL DEFAULT 1.0, -- 影子执行总预算
  "costSpent" DECIMAL(12,6) NOT NULL DEFAULT 0.0, -- 已花费
  "autoRollback" BOOLEAN NOT NULL DEFAULT true, -- 自动回滚
  "lastRolledBack" TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Shadow Execution Log（影子执行日志）
-- ============================================================
CREATE TABLE IF NOT EXISTS "ShadowExecutionLog" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shadowConfigId" TEXT NOT NULL REFERENCES "ShadowConfig"("id"),
  "sandboxLogId" TEXT,  -- 关联的 Sandbox 执行日志
  "taskId" TEXT,
  "projectId" TEXT,
  "userId" TEXT,
  "taskType" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "mockOutput" JSONB,
  "realOutput" JSONB,
  "mockLatencyMs" INTEGER,
  "realLatencyMs" INTEGER,
  "mockCost" DECIMAL(12,6) DEFAULT 0,
  "realCost" DECIMAL(12,6) DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',  -- pending | success | failed | timeout | shadow_failed
  "errorMessage" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "executedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shadow_execution_log_config" ON "ShadowExecutionLog"("shadowConfigId");
CREATE INDEX IF NOT EXISTS "idx_shadow_execution_log_status" ON "ShadowExecutionLog"("status");
CREATE INDEX IF NOT EXISTS "idx_shadow_execution_log_model" ON "ShadowExecutionLog"("modelName");

-- ============================================================
-- 3. Shadow Diff Result（Mock vs Real 对比结果）
-- ============================================================
CREATE TABLE IF NOT EXISTS "ShadowDiffResult" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "executionLogId" TEXT NOT NULL REFERENCES "ShadowExecutionLog"("id"),
  "taskType" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "structureMatch" BOOLEAN NOT NULL DEFAULT false,  -- JSON结构一致性
  "structureScore" DECIMAL(5,2) DEFAULT 0,  -- 0-100
  "contentScore" DECIMAL(5,2) DEFAULT 0,    -- AI 质量评分 0-100
  "latencyDelta" DECIMAL(10,2) DEFAULT 0,    -- 延迟差异(ms)
  "costDelta" DECIMAL(12,6) DEFAULT 0,       -- 成本差异
  "driftScore" DECIMAL(5,2) DEFAULT 0,       -- 漂移评分 0-100
  "overallScore" DECIMAL(5,2) DEFAULT 0,     -- 综合评分
  "judgedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shadow_diff_task_type" ON "ShadowDiffResult"("taskType");
CREATE INDEX IF NOT EXISTS "idx_shadow_diff_model" ON "ShadowDiffResult"("modelName");
CREATE INDEX IF NOT EXISTS "idx_shadow_diff_score" ON "ShadowDiffResult"("overallScore");

-- ============================================================
-- 4. Shadow Drift History（漂移历史）
-- ============================================================
CREATE TABLE IF NOT EXISTS "ShadowDriftHistory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "modelName" TEXT NOT NULL,
  "taskType" TEXT NOT NULL,
  "windowCount" INTEGER NOT NULL DEFAULT 0,   -- 窗口内样本数
  "avgDriftScore" DECIMAL(5,2) DEFAULT 0,     -- 平均漂移
  "avgStructureScore" DECIMAL(5,2) DEFAULT 0,
  "avgContentScore" DECIMAL(5,2) DEFAULT 0,
  "avgLatencyDelta" DECIMAL(10,2) DEFAULT 0,
  "avgCostDelta" DECIMAL(12,6) DEFAULT 0,
  "sampleStartAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "sampleEndAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_shadow_drift_model_type" ON "ShadowDriftHistory"("modelName", "taskType");

-- ============================================================
-- 5. Cost Budget V2（4层成本控制）
-- ============================================================
CREATE TABLE IF NOT EXISTS "CostBudget" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scope" TEXT NOT NULL,  -- 'global' | 'project' | 'user' | 'task_type'
  "scopeId" TEXT,         -- scope 的 ID（projectId / userId / taskType）
  "budgetAmount" DECIMAL(12,6) NOT NULL,  -- 预算金额
  "spentAmount" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "alertThreshold" INTEGER NOT NULL DEFAULT 80,  -- 预警百分比
  "blockThreshold" INTEGER NOT NULL DEFAULT 100, -- 阻断百分比
  "period" TEXT NOT NULL DEFAULT 'monthly',  -- 'daily' | 'weekly' | 'monthly'
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastAlertAt" TIMESTAMP,
  "lastBlockedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_cost_budget_scope" ON "CostBudget"("scope", "scopeId");

-- ============================================================
-- 6. 种子数据：Shadow Config（默认关闭）
-- ============================================================
INSERT INTO "ShadowConfig" ("id", "enabled", "grayThreshold", "maxConcurrent", "rateLimitPerMin", "costBudget", "costSpent", "autoRollback")
VALUES ('default-shadow-config', false, 0, 5, 10, 1.0, 0.0, true)
ON CONFLICT ("id") DO NOTHING;

-- ============================================================
-- 7. 种子数据：Cost Budget（4层默认预算）
-- ============================================================
INSERT INTO "CostBudget" ("id", "scope", "scopeId", "budgetAmount", "spentAmount", "period")
VALUES
  ('budget-global-monthly', 'global', NULL, 100.0, 0, 'monthly'),
  ('budget-task-video', 'task_type', 'video_gen', 50.0, 0, 'monthly'),
  ('budget-task-text', 'task_type', 'text_script', 20.0, 0, 'monthly'),
  ('budget-task-image', 'task_type', 'character_gen', 30.0, 0, 'monthly'),
  ('budget-task-voice', 'task_type', 'voiceover', 10.0, 0, 'monthly')
ON CONFLICT ("id") DO NOTHING;
