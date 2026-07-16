-- Sprint 4.2.4-A — Outcome Intelligence Foundation
-- CTO APPROVED with 5 Contract Adjustments
-- Date: 2026-07-16

-- ═══════════════════════════════════════════════════════════
-- enterprise_outcome — Action 完成后的结构化事实层
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_outcome (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  governance_tenant_id  UUID,
  action_id             UUID NOT NULL UNIQUE,

  -- CTO 调整: outcomeType + sourceType
  outcome_type          TEXT NOT NULL DEFAULT 'OPERATIONAL',
  source_type           TEXT NOT NULL DEFAULT 'HUMAN',

  -- 生命周期
  status                TEXT NOT NULL DEFAULT 'PENDING_VERIFY',

  -- 事实内容
  summary               TEXT,
  evidence              JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Impact (Framework, not Revenue)
  impact_type           TEXT,
  impact_level          INTEGER,
  impact_metric         TEXT,
  impact_value          TEXT,
  impact_source         TEXT DEFAULT 'manual',

  -- 时间
  occurred_at           TIMESTAMPTZ,
  verified_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_action FOREIGN KEY (action_id) REFERENCES enterprise_action(id) ON DELETE CASCADE
);

CREATE INDEX idx_outcome_tenant ON enterprise_outcome(tenant_id);
CREATE INDEX idx_outcome_gov ON enterprise_outcome(governance_tenant_id);
CREATE INDEX idx_outcome_action ON enterprise_outcome(action_id);
CREATE INDEX idx_outcome_status ON enterprise_outcome(status);
CREATE INDEX idx_outcome_type ON enterprise_outcome(outcome_type);
CREATE INDEX idx_outcome_impact ON enterprise_outcome(impact_type);

-- ═══════════════════════════════════════════════════════════
-- enterprise_decision_feedback — Decision Confidence 反馈
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_decision_feedback (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             UUID NOT NULL,
  governance_tenant_id  UUID,

  decision_id           UUID NOT NULL,
  outcome_id            UUID NOT NULL,

  confidence_delta      INTEGER NOT NULL DEFAULT 0,
  reason                TEXT,
  feedback_type         TEXT NOT NULL DEFAULT 'learn',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_feedback_decision FOREIGN KEY (decision_id) REFERENCES enterprise_recommendation(id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_outcome FOREIGN KEY (outcome_id) REFERENCES enterprise_outcome(id) ON DELETE CASCADE
);

CREATE INDEX idx_feedback_tenant ON enterprise_decision_feedback(tenant_id);
CREATE INDEX idx_feedback_decision ON enterprise_decision_feedback(decision_id);
CREATE INDEX idx_feedback_outcome ON enterprise_decision_feedback(outcome_id);
