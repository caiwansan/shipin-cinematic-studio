-- Phase 2.2.3 — Workflow Runtime
-- 创建 Workflow 相关表

-- 1. Workflow Definition（DAG 模板）
CREATE TABLE IF NOT EXISTS enterprise_agent_workflow_definition (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    nodes TEXT NOT NULL DEFAULT '[]',
    edges TEXT NOT NULL DEFAULT '[]',
    version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wf_def_org ON enterprise_agent_workflow_definition(organization_id);
CREATE INDEX IF NOT EXISTS idx_wf_def_status ON enterprise_agent_workflow_definition(status);

-- 2. Workflow Instance（运行实例）
CREATE TABLE IF NOT EXISTS enterprise_agent_workflow (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    definition_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT,
    result TEXT,
    current_step_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wf_inst_org ON enterprise_agent_workflow(organization_id);
CREATE INDEX IF NOT EXISTS idx_wf_inst_agent ON enterprise_agent_workflow(agent_id);
CREATE INDEX IF NOT EXISTS idx_wf_inst_status ON enterprise_agent_workflow(status);

-- 3. Workflow Step（执行节点）
CREATE TABLE IF NOT EXISTS enterprise_agent_workflow_step (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workflow_instance_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    node_type TEXT NOT NULL,
    step_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    input TEXT,
    output TEXT,
    error TEXT,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    approval_status TEXT DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wf_step_instance ON enterprise_agent_workflow_step(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_step_status ON enterprise_agent_workflow_step(status);
