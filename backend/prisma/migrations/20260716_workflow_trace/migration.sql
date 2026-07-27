-- Phase 2.2.4 Patch-B — Workflow Execution Trace
-- 记录 Workflow 每个 Step 的执行详情

CREATE TABLE IF NOT EXISTS workflow_execution_trace (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    workflow_instance_id TEXT NOT NULL,
    step_id TEXT,
    agent_id TEXT,
    action TEXT NOT NULL,
    node_type TEXT,
    status TEXT NOT NULL,
    duration_ms INTEGER DEFAULT 0,
    token_usage INTEGER DEFAULT 0,
    cost FLOAT DEFAULT 0,
    input_summary TEXT,
    output_summary TEXT,
    error_message TEXT,
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wf_trace_org ON workflow_execution_trace(organization_id);
CREATE INDEX IF NOT EXISTS idx_wf_trace_instance ON workflow_execution_trace(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_wf_trace_agent ON workflow_execution_trace(agent_id);
CREATE INDEX IF NOT EXISTS idx_wf_trace_created ON workflow_execution_trace(created_at);
