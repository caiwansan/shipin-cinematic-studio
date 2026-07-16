-- Phase 4 Revenue Intelligence
-- 新建 enterprise_lead_intelligence + enterprise_roi_snapshot
-- CTO修正: +probability_source, +value_source (非黑盒)

CREATE TABLE enterprise_lead_intelligence (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id         TEXT NOT NULL,
  interaction_id    TEXT,
  platform          VARCHAR(30),
  platform_user_id  TEXT,
  -- 客户画像
  customer_name     VARCHAR(100),
  customer_type     VARCHAR(30),
  industry          VARCHAR(50),
  company_size      VARCHAR(20),
  -- 意向分析
  intent_score      INT DEFAULT 0,
  intent_signals    TEXT DEFAULT '[]',
  temperature       VARCHAR(10) DEFAULT 'cold',
  purchase_prob     INT DEFAULT 0,
  probability_source VARCHAR(30) DEFAULT 'algorithm', -- CTO修正: algorithm|manual|ai_review
  estimated_value   INT DEFAULT 0,
  value_source      VARCHAR(30) DEFAULT 'industry_template', -- CTO修正: industry_template|customer_input|deal_history
  -- 跟进管理
  next_action       TEXT,
  next_action_date  DATE,
  assigned_agent    TEXT,
  status            VARCHAR(20) DEFAULT 'new',
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eli_tenant ON enterprise_lead_intelligence(tenant_id);
CREATE INDEX idx_eli_temp ON enterprise_lead_intelligence(tenant_id, temperature);
CREATE INDEX idx_eli_prob ON enterprise_lead_intelligence(tenant_id, purchase_prob DESC);
CREATE INDEX idx_eli_status ON enterprise_lead_intelligence(tenant_id, status);

CREATE TABLE enterprise_roi_snapshot (
  id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id         TEXT NOT NULL,
  snapshot_date     DATE NOT NULL,
  -- 投入
  plan_cost         INT DEFAULT 0,
  token_cost        INT DEFAULT 0,
  channel_cost      INT DEFAULT 0,
  total_cost        INT DEFAULT 0,
  -- 已产生价值（真实）
  leads_generated   INT DEFAULT 0,
  hot_leads         INT DEFAULT 0,
  interactions      INT DEFAULT 0,
  opportunities     INT DEFAULT 0,
  -- 预测价值（模型）
  estimated_revenue INT DEFAULT 0,
  -- 效率
  cost_per_lead     INT DEFAULT 0,
  roi_ratio         NUMERIC(5,2) DEFAULT 0,
  detail            TEXT DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ers_tenant_date ON enterprise_roi_snapshot(tenant_id, snapshot_date);
