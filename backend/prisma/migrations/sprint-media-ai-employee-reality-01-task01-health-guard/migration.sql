-- SPRINT-MEDIA-AI-EMPLOYEE-REALITY-01 Task01 — ChannelHealthState
-- 渠道健康守卫：账号执行侧保护。HEALTHY / DEGRADED / NEEDS_ATTENTION
-- 30 分钟窗口失败 ≥3 次或致命信号 → NEEDS_ATTENTION + 暂停绑定
CREATE TABLE IF NOT EXISTS "channel_health_state" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "organization_id" TEXT,
  "channel_account_id" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'HEALTHY',
  "failure_count" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_failure_at" TIMESTAMP(3),
  "last_error" TEXT,
  "last_signal" TEXT,
  "paused_at" TIMESTAMP(3),
  "paused_by" TEXT,
  "pause_reason" TEXT,
  "recovered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_health_state_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "channel_health_state_channel_account_id_key" ON "channel_health_state" ("channel_account_id");
CREATE INDEX IF NOT EXISTS "channel_health_state_tenant_id_idx" ON "channel_health_state" ("tenant_id");
CREATE INDEX IF NOT EXISTS "channel_health_state_state_idx" ON "channel_health_state" ("state");
