-- Migration: Extend enterprise_agent_profile for Agent Runtime
-- Phase 2.2.1 — Runtime Skeleton

-- 添加 Runtime 相关字段
ALTER TABLE enterprise_agent_profile
  ADD COLUMN IF NOT EXISTS runtime_type TEXT DEFAULT 'openclaw',
  ADD COLUMN IF NOT EXISTS runtime_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS runtime_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS last_execution_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_profile_org_status
  ON enterprise_agent_profile (organization_id, status);

CREATE INDEX IF NOT EXISTS idx_enterprise_agent_profile_runtime_status
  ON enterprise_agent_profile (runtime_status);

-- 为 Agent Audit Trail 添加索引
CREATE INDEX IF NOT EXISTS idx_agent_audit_trail_agent_action
  ON agent_audit_trail (agent_id, action);
