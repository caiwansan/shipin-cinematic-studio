-- ============================================================
-- Migration: Job Agent Config — 求职管家 Agent 模型配置
-- Date: 2026-07-26
-- Reuse existing crypto service for API Key encryption
-- ============================================================

-- CreateTable: job_agent_config
CREATE TABLE IF NOT EXISTS "job_agent_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_type" TEXT NOT NULL DEFAULT 'career_assistant',
    "agent_name" TEXT NOT NULL DEFAULT '求职管家',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "api_key_encrypted" TEXT NOT NULL DEFAULT '',
    "base_url" TEXT,
    "system_prompt" TEXT,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "max_tokens" INTEGER NOT NULL DEFAULT 2000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "total_calls" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_agent_config_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "job_agent_config_agent_type_idx" ON "job_agent_config"("agent_type");
CREATE INDEX IF NOT EXISTS "job_agent_config_enabled_idx" ON "job_agent_config"("enabled");
