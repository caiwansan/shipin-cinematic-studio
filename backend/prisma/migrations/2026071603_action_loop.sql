-- ═══════════════════════════════════════════════════════════
-- Sprint 4.2.3 — Action Loop v1
-- CTO Review: APPROVED (2026-07-16)
-- 新增 enterprise_action 表
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_action (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL,
    decision_id         UUID NOT NULL,
    
    title               VARCHAR(500) NOT NULL,
    description         TEXT,
    
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    priority            VARCHAR(10) DEFAULT 'P3',
    
    owner_type          VARCHAR(20) NOT NULL DEFAULT 'human',
    owner_id            TEXT NOT NULL,
    
    -- Approval Gate
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ,
    approval_note       TEXT,
    
    -- Execution Tracking
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    execution_result    TEXT,
    
    -- Verification
    verified_at         TIMESTAMPTZ,
    verification_result TEXT,
    
    -- CTO 修正: status history (审计日志)
    status_history      JSONB DEFAULT '[]',
    
    -- Metadata
    due_date            TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_action_decision FOREIGN KEY (decision_id) REFERENCES enterprise_recommendation(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_action_tenant ON enterprise_action(tenant_id);
CREATE INDEX idx_action_decision ON enterprise_action(decision_id);
CREATE INDEX idx_action_status ON enterprise_action(status);
CREATE INDEX idx_action_owner ON enterprise_action(owner_type, owner_id);
CREATE INDEX idx_action_tenant_status ON enterprise_action(tenant_id, status);
CREATE INDEX idx_action_tenant_owner ON enterprise_action(tenant_id, owner_type, owner_id);
CREATE INDEX idx_action_due_date ON enterprise_action(due_date);
