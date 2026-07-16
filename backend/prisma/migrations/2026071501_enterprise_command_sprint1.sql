-- Enterprise Operation Workspace Sprint 1 v1.1
-- CEO Intent Layer: enterprise_command 新表
-- AI员工管理: enterprise_agent_profile 扩展

-- 1. 新增 enterprise_command 表
CREATE TABLE IF NOT EXISTS enterprise_command (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id    TEXT NOT NULL,
    creator_id   TEXT NOT NULL,
    content      TEXT NOT NULL,
    command_type VARCHAR(30) NOT NULL DEFAULT 'custom',
    priority     VARCHAR(20) NOT NULL DEFAULT 'normal',
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    planner_result JSONB,
    result_summary TEXT,
    result_json  JSONB,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    started_at   TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_command_tenant_status ON enterprise_command(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_command_tenant_created ON enterprise_command(tenant_id, created_at);

-- 2. 扩展 enterprise_agent_profile（新增3字段）
ALTER TABLE enterprise_agent_profile
    ADD COLUMN IF NOT EXISTS daily_target INTEGER,
    ADD COLUMN IF NOT EXISTS working_hours VARCHAR(50),
    ADD COLUMN IF NOT EXISTS manager_note TEXT;
