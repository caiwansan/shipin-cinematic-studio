-- SPRINT-MEDIA-AI-EMPLOYEE-OPERATION-REALITY-01 Task02 — ChannelMetricSnapshot
-- 渠道指标快照（真实数据持久化）。无数据 = null，禁止 0 冒充；unavailable 带 reason。
CREATE TABLE IF NOT EXISTS "channel_metric_snapshot" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "organization_id" TEXT,
  "channel_account_id" TEXT NOT NULL,
  "workspace_id" TEXT,
  "agent_id" TEXT,
  "platform" TEXT NOT NULL,
  "follower_count" INTEGER,
  "like_count" INTEGER,
  "video_count" INTEGER,
  "total_views" INTEGER,
  "recent_views" INTEGER,
  "recent_follower_delta" INTEGER,
  "interaction_rate" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'available',
  "unavailable_reason" TEXT,
  "source" TEXT,
  "collected_at" TIMESTAMP(3) NOT NULL,
  "raw_data" JSONB DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "channel_metric_snapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "channel_metric_snapshot_channel_account_id_collected_at_idx" ON "channel_metric_snapshot" ("channel_account_id", "collected_at");
CREATE INDEX IF NOT EXISTS "channel_metric_snapshot_tenant_id_idx" ON "channel_metric_snapshot" ("tenant_id");
CREATE INDEX IF NOT EXISTS "channel_metric_snapshot_status_idx" ON "channel_metric_snapshot" ("status");
