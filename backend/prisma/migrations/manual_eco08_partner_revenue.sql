-- SPRINT-ECO-08 Partner Revenue Share Foundation
-- 掌柜范围：✅ 数据模型 ✅ 收益计算规则 ✅ 等级模型 ✅ 结算关系
--          ❌ 推广页面 ❌ 邀请系统 ❌ 用户裂变 ❌ 奖励发放（仅 ACCRUED）
-- 纪律：收益来源唯一 = ecology_settlements（插件订阅真实收入）

-- 1. 等级配置表（PartnerLevelPolicy：level/minPerformance/rewardRate/effectiveDate/status）
CREATE TABLE IF NOT EXISTS ecology_partner_level_policies (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  level           INTEGER NOT NULL UNIQUE,
  level_name      VARCHAR(50) NOT NULL,
  min_performance DECIMAL(14,2) NOT NULL,
  reward_rate     DECIMAL(5,4) NOT NULL,
  effective_date  TIMESTAMP NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_level_status ON ecology_partner_level_policies(status);

-- 2. 伙伴身份表（团队树边 = sponsor_partner_id；不做邀请 UI）
CREATE TABLE IF NOT EXISTS ecology_partners (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id         VARCHAR(64) NOT NULL UNIQUE,
  user_id            TEXT NOT NULL,
  organization_id    TEXT NOT NULL,
  partner_name       VARCHAR(100) NOT NULL,
  sponsor_partner_id TEXT,
  level              INTEGER NOT NULL DEFAULT 1,
  status             VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partners_org ON ecology_partners(organization_id);
CREATE INDEX IF NOT EXISTS idx_partners_sponsor ON ecology_partners(sponsor_partner_id);
CREATE INDEX IF NOT EXISTS idx_partners_status ON ecology_partners(status);

-- 3. 业绩快照表（按结算周期计算；收益来源唯一 = ecology_settlements）
CREATE TABLE IF NOT EXISTS ecology_partner_performances (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id             TEXT NOT NULL REFERENCES ecology_partners(id) ON DELETE CASCADE,
  period                 VARCHAR(7) NOT NULL,
  team_performance       DECIMAL(14,2) NOT NULL DEFAULT 0,
  max_line_performance   DECIMAL(14,2) NOT NULL DEFAULT 0,
  small_area_performance DECIMAL(14,2) NOT NULL DEFAULT 0,
  level                  INTEGER NOT NULL,
  reward_rate            DECIMAL(5,4) NOT NULL DEFAULT 0,
  accrued_reward         DECIMAL(14,2) NOT NULL DEFAULT 0,
  status                 VARCHAR(20) NOT NULL DEFAULT 'COMPUTED',
  detail                 JSONB,
  computed_at            TIMESTAMP NOT NULL DEFAULT now(),
  created_at             TIMESTAMP NOT NULL DEFAULT now(),
  updated_at             TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (partner_id, period)
);
CREATE INDEX IF NOT EXISTS idx_partner_perf_period ON ecology_partner_performances(period);

-- 4. 应计分红记录表（ACCRUED 止；PAID/SETTLED 流程冻结）
CREATE TABLE IF NOT EXISTS ecology_partner_rewards (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  partner_id    TEXT NOT NULL REFERENCES ecology_partners(id) ON DELETE CASCADE,
  period        VARCHAR(7) NOT NULL,
  performance_id TEXT NOT NULL,
  reward_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  status        VARCHAR(20) NOT NULL DEFAULT 'ACCRUED',
  detail        JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (partner_id, period)
);
CREATE INDEX IF NOT EXISTS idx_partner_reward_perf ON ecology_partner_rewards(performance_id);

-- 5. 种子：6 级等级配置冻结（掌柜冻结）
-- 普通推广伙伴 0 / 生态推广伙伴 10万 / 区域生态伙伴 30万 / 城市生态伙伴 60万 / 省级生态伙伴 120万 / 平台生态合伙人 300万
INSERT INTO ecology_partner_level_policies (level, level_name, min_performance, reward_rate, effective_date, status) VALUES
  (1, '普通推广伙伴',   0,       0.0200, now(), 'ACTIVE'),
  (2, '生态推广伙伴',   100000,  0.0250, now(), 'ACTIVE'),
  (3, '区域生态伙伴',   300000,  0.0300, now(), 'ACTIVE'),
  (4, '城市生态伙伴',   600000,  0.0350, now(), 'ACTIVE'),
  (5, '省级生态伙伴',   1200000, 0.0400, now(), 'ACTIVE'),
  (6, '平台生态合伙人', 3000000, 0.0500, now(), 'ACTIVE')
ON CONFLICT (level) DO UPDATE SET
  level_name = EXCLUDED.level_name,
  min_performance = EXCLUDED.min_performance,
  reward_rate = EXCLUDED.reward_rate,
  effective_date = EXCLUDED.effective_date,
  status = EXCLUDED.status,
  updated_at = now();
