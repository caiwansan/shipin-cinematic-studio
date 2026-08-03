-- SPRINT-ECO-07 — Revenue Settlement Foundation
-- 收入计算基础设施（非财务系统）：结算记录 / 结算明细 / 分成规则配置化
-- 核心链：License → License Events → Revenue Snapshot → Settlement Record → Developer Share
-- 纪律：不做提现 / 不做钱包 / 不做支付改造 / 不做推广奖励 / 不做银行接口
-- 只新增 ecology_* 表 + marketplace_items.price 登记列；零商业系统改动

-- 0. marketplace_items 加订阅单价登记列（应计收入计算依据，非实收）
ALTER TABLE ecology_marketplace_items ADD COLUMN IF NOT EXISTS price DECIMAL(12, 2);

-- 1. ecology_revenue_share_policies — 分成规则配置化（不写死比例）
CREATE TABLE IF NOT EXISTS ecology_revenue_share_policies (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  developer_id   TEXT,               -- ecology_developers.id；NULL = 平台默认策略
  plugin_id      TEXT UNIQUE,        -- ecology_plugins.id；NULL = 开发者级默认；非 NULL 必须带 developer_id
  developer_rate DECIMAL(5, 2) NOT NULL,  -- 0.70 = 70%
  platform_rate  DECIMAL(5, 2) NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | DISABLED
  created_at     TIMESTAMP NOT NULL DEFAULT now(),
  updated_at     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT ecology_revenue_share_policies_platform_default CHECK (
    (developer_id IS NULL AND plugin_id IS NULL) OR developer_id IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS ecology_revenue_share_policies_developer_id_idx ON ecology_revenue_share_policies (developer_id);
CREATE INDEX IF NOT EXISTS ecology_revenue_share_policies_status_idx ON ecology_revenue_share_policies (status);
-- 平台默认策略种子（配置数据，可管理，非代码写死）
INSERT INTO ecology_revenue_share_policies (developer_id, plugin_id, developer_rate, platform_rate, status)
SELECT NULL, NULL, 0.70, 0.30, 'ACTIVE'
WHERE NOT EXISTS (SELECT 1 FROM ecology_revenue_share_policies WHERE developer_id IS NULL AND plugin_id IS NULL);

-- 2. ecology_settlements — 结算记录（掌柜字段：period/pluginId/developerId/gross/developer/platform/status）
CREATE TABLE IF NOT EXISTS ecology_settlements (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  period           VARCHAR(7) NOT NULL,   -- 'YYYY-MM'（月度结算）
  plugin_id        TEXT NOT NULL,         -- ecology_plugins.id
  developer_id     TEXT NOT NULL,         -- ecology_developers.id（收入归属）
  gross_amount     DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- 应计收入（登记单价×许可数，未接支付非实收）
  developer_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- 开发者分成（策略计算）
  platform_amount  DECIMAL(12, 2) NOT NULL DEFAULT 0,   -- 平台收入
  currency         VARCHAR(10) NOT NULL DEFAULT 'CNY',
  status           VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT | CONFIRMED | FINALIZED（不可回退）
  detail           JSONB NOT NULL DEFAULT '{}',  -- 对账结果 / 策略来源 / 单价来源（留痕）
  created_at       TIMESTAMP NOT NULL DEFAULT now(),
  updated_at       TIMESTAMP NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ecology_settlements_plugin_id_period_key ON ecology_settlements (plugin_id, period);
CREATE INDEX IF NOT EXISTS ecology_settlements_developer_id_idx ON ecology_settlements (developer_id);
CREATE INDEX IF NOT EXISTS ecology_settlements_period_idx ON ecology_settlements (period);
CREATE INDEX IF NOT EXISTS ecology_settlements_status_idx ON ecology_settlements (status);

-- 3. ecology_settlement_items — 结算明细（逐许可可追溯）
CREATE TABLE IF NOT EXISTS ecology_settlement_items (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  settlement_id TEXT NOT NULL,      -- ecology_settlements.id
  license_id    TEXT,               -- ecology_licenses.id（可追溯；无明细时汇总为 NULL）
  plugin_id     TEXT NOT NULL,
  period        VARCHAR(7) NOT NULL,
  amount        DECIMAL(12, 2) NOT NULL DEFAULT 0,
  source        VARCHAR(30) NOT NULL,  -- LICENSE_EVENT | SNAPSHOT
  created_at    TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ecology_settlement_items_settlement_id_idx ON ecology_settlement_items (settlement_id);
CREATE INDEX IF NOT EXISTS ecology_settlement_items_license_id_idx ON ecology_settlement_items (license_id);

-- 回滚：
--   DROP TABLE IF EXISTS ecology_settlement_items;
--   DROP TABLE IF EXISTS ecology_settlements;
--   DROP TABLE IF EXISTS ecology_revenue_share_policies;
--   ALTER TABLE ecology_marketplace_items DROP COLUMN IF EXISTS price;
