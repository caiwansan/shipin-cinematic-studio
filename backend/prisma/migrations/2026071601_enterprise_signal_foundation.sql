-- Phase 4.2 Sprint 4.2.1 — Enterprise Signal Foundation
-- 新增 3 张表: OperationEvent / Signal / Recommendation

-- 运营事件表 (OperationEvent)
CREATE TABLE enterprise_operation_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(100) NOT NULL,
    actor_name VARCHAR(200),
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oe_tenant_event ON enterprise_operation_event (tenant_id, event_type);
CREATE INDEX idx_oe_tenant_time ON enterprise_operation_event (tenant_id, created_at DESC);

-- 业务信号表 (EnterpriseSignal)
CREATE TABLE enterprise_signal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    signal_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    source_events JSONB DEFAULT '[]',
    description TEXT,
    suggested_action TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_signal_tenant_status ON enterprise_signal (tenant_id, status);
CREATE INDEX idx_signal_tenant_severity ON enterprise_signal (tenant_id, severity);

-- 决策建议表 (EnterpriseRecommendation)
CREATE TABLE enterprise_recommendation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    signal_id UUID,
    category VARCHAR(50) NOT NULL,
    priority INTEGER NOT NULL DEFAULT 3,
    title VARCHAR(500) NOT NULL,
    rationale TEXT,
    expected_impact TEXT,
    action_plan JSONB DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    outcome TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rec_tenant_status ON enterprise_recommendation (tenant_id, status);
CREATE INDEX idx_rec_tenant_priority ON enterprise_recommendation (tenant_id, priority);
CREATE INDEX idx_rec_signal ON enterprise_recommendation (signal_id);
