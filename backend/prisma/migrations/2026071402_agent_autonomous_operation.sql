-- Phase 2.5: Agent Autonomous Operation
-- 新增：agent_schedule（定时任务）+ agent_goal（每日目标）

-- Agent Schedule Table
CREATE TABLE IF NOT EXISTS agent_schedule (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    schedule_type VARCHAR(20) NOT NULL DEFAULT 'daily',
    cron_expression VARCHAR(50) NOT NULL,
    task_template TEXT NOT NULL,
    task_type VARCHAR(30) NOT NULL DEFAULT 'auto',
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_schedule_tenant_enabled ON agent_schedule(tenant_id, enabled);
CREATE INDEX IF NOT EXISTS idx_agent_schedule_agent ON agent_schedule(agent_id);

-- Agent Goal Table
CREATE TABLE IF NOT EXISTS agent_goal (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    goal_date VARCHAR(10) NOT NULL,
    goal_type VARCHAR(30) NOT NULL,
    description TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 0,
    actual_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    evidence TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(agent_id, goal_date, goal_type)
);

CREATE INDEX IF NOT EXISTS idx_agent_goal_tenant_date ON agent_goal(tenant_id, goal_date);
CREATE INDEX IF NOT EXISTS idx_agent_goal_agent ON agent_goal(agent_id);

-- Comment
COMMENT ON TABLE agent_schedule IS 'Agent 定时任务配置（Phase 2.5 Autonomous Operation）';
COMMENT ON TABLE agent_goal IS 'Agent 每日目标与完成追踪';
