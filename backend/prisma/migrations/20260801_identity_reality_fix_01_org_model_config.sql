-- SPRINT-IDENTITY-REALITY-FIX-01 — 企业 AI 员工模型配置架构纠偏（BYOK）
-- 昆仑镜 = AI 员工操作系统，企业提供算力，平台不托管企业 Key
-- 新权威：org_model_config（模型选择）+ provider_credential（加密 Key，企业资产）
-- EnterpriseLlmConfig/AgentModelBinding/ModelRoutingPolicy → deprecated（保留兼容读取）

CREATE TABLE IF NOT EXISTS "org_model_config" (
  "id"              TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "organization_id" UUID        NOT NULL,
  "provider"        VARCHAR(50) NOT NULL,
  "model"           VARCHAR(200) NOT NULL,
  "fallback_model"  VARCHAR(200),
  "capability"      VARCHAR(20) NOT NULL DEFAULT 'llm',
  "enabled"         BOOLEAN     NOT NULL DEFAULT true,
  "is_default"      BOOLEAN     NOT NULL DEFAULT false,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "org_model_config_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "org_model_config_unique" UNIQUE ("organization_id", "provider", "model")
);
CREATE INDEX IF NOT EXISTS "org_model_config_organization_id_enabled_idx" ON "org_model_config" ("organization_id", "enabled");

CREATE TABLE IF NOT EXISTS "provider_credential" (
  "id"                  TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "owner_type"          VARCHAR(20) NOT NULL DEFAULT 'organization',
  "organization_id"     UUID,
  "user_id"             UUID,
  "provider"            VARCHAR(50) NOT NULL,
  "encrypted_key"       TEXT        NOT NULL,
  "status"              VARCHAR(20) NOT NULL DEFAULT 'active',
  "health_status"       VARCHAR(20) NOT NULL DEFAULT 'untested',
  "health_latency_ms"   INTEGER,
  "health_error"        TEXT,
  "last_health_check_at" TIMESTAMP(3),
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_credential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_credential_unique" UNIQUE ("owner_type", "organization_id", "provider")
);
CREATE INDEX IF NOT EXISTS "provider_credential_organization_id_idx" ON "provider_credential" ("organization_id");

-- G5: usage_logs 成本归属企业 + AI 员工维度 + 实际模型
ALTER TABLE "usage_logs" ADD COLUMN IF NOT EXISTS "organization_id" UUID;
ALTER TABLE "usage_logs" ADD COLUMN IF NOT EXISTS "agent_id" TEXT;
ALTER TABLE "usage_logs" ADD COLUMN IF NOT EXISTS "model" VARCHAR(200);
CREATE INDEX IF NOT EXISTS "usage_logs_organization_id_idx" ON "usage_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "usage_logs_agent_id_idx" ON "usage_logs" ("agent_id");
