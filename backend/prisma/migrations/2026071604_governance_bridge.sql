-- Sprint 4.2.3.1 — Enterprise Foundation Alignment
-- Step 1: 新增 governanceTenantId 列（nullable，不破坏现有数据）
-- CTO 冻结: Phase 1 — Schema Expand

-- Enterprise Operation Event
ALTER TABLE enterprise_operation_event 
  ADD COLUMN governance_tenant_id TEXT;

CREATE INDEX idx_eoe_gov_tenant ON enterprise_operation_event(governance_tenant_id);

-- Enterprise Signal
ALTER TABLE enterprise_signal 
  ADD COLUMN governance_tenant_id TEXT;

CREATE INDEX idx_es_gov_tenant ON enterprise_signal(governance_tenant_id);

-- Enterprise Recommendation
ALTER TABLE enterprise_recommendation 
  ADD COLUMN governance_tenant_id TEXT;

CREATE INDEX idx_er_gov_tenant ON enterprise_recommendation(governance_tenant_id);

-- Enterprise Action
ALTER TABLE enterprise_action 
  ADD COLUMN governance_tenant_id TEXT,
  ADD COLUMN approved_by_gov_user_id TEXT;

CREATE INDEX idx_ea_gov_tenant ON enterprise_action(governance_tenant_id);
CREATE INDEX idx_ea_gov_approver ON enterprise_action(approved_by_gov_user_id);

-- 外键约束（nullable，不强制）
ALTER TABLE enterprise_operation_event 
  ADD CONSTRAINT fk_eoe_gov_tenant FOREIGN KEY (governance_tenant_id) REFERENCES governance_tenant(id) ON DELETE SET NULL;

ALTER TABLE enterprise_signal 
  ADD CONSTRAINT fk_es_gov_tenant FOREIGN KEY (governance_tenant_id) REFERENCES governance_tenant(id) ON DELETE SET NULL;

ALTER TABLE enterprise_recommendation 
  ADD CONSTRAINT fk_er_gov_tenant FOREIGN KEY (governance_tenant_id) REFERENCES governance_tenant(id) ON DELETE SET NULL;

ALTER TABLE enterprise_action 
  ADD CONSTRAINT fk_ea_gov_tenant FOREIGN KEY (governance_tenant_id) REFERENCES governance_tenant(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_ea_gov_approver FOREIGN KEY (approved_by_gov_user_id) REFERENCES governance_user(id) ON DELETE SET NULL;
