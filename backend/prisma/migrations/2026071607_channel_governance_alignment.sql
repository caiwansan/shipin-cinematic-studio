-- Sprint 4.2.5.1 — Channel Governance Alignment
-- CTO APPROVED: 2026-07-15
-- Contracts: Ownership + Permission + Tenant Isolation + Audit + External Binding

-- ============================================================
-- 1. EnterpriseChannelAccount: 追加 Ownership 字段
-- ============================================================
ALTER TABLE enterprise_channel_account
  ADD COLUMN IF NOT EXISTS organization_id TEXT,
  ADD COLUMN IF NOT EXISTS created_by_gov_user_id TEXT,
  ADD COLUMN IF NOT EXISTS manage_role TEXT DEFAULT 'CHANNEL_OWNER';

-- CTO 建议索引
CREATE INDEX IF NOT EXISTS idx_channel_account_tenant_org
  ON enterprise_channel_account(tenant_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_channel_account_owner
  ON enterprise_channel_account(owner_id);
CREATE INDEX IF NOT EXISTS idx_channel_account_type_status
  ON enterprise_channel_account(channel_type, connection_status);

-- ============================================================
-- 2. EnterpriseInteraction: 追加 organizationId (Tenant Isolation)
-- ============================================================
ALTER TABLE enterprise_interaction
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS idx_interaction_org
  ON enterprise_interaction(organization_id);

-- ============================================================
-- 3. ChannelCustomerMapping: 新表 (External Account Binding)
-- ============================================================
CREATE TABLE IF NOT EXISTS channel_customer_mapping (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT NOT NULL,
  governance_tenant_id TEXT,
  organization_id TEXT,

  channel_type TEXT NOT NULL,
  channel_account_id TEXT NOT NULL,
  external_customer_id TEXT NOT NULL,
  external_open_id TEXT,

  internal_customer_id TEXT,
  internal_gov_user_id TEXT,

  external_name TEXT,
  external_avatar TEXT,
  metadata JSONB DEFAULT '{}',

  first_interaction_at TIMESTAMPTZ,
  last_interaction_at TIMESTAMPTZ,
  interaction_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 唯一约束：同一 Tenant 内同一外部客户唯一（防止跨租户污染）
CREATE UNIQUE INDEX IF NOT EXISTS idx_ccm_unique_customer
  ON channel_customer_mapping(tenant_id, channel_type, external_customer_id);

-- 性能索引
CREATE INDEX IF NOT EXISTS idx_ccm_tenant
  ON channel_customer_mapping(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ccm_org
  ON channel_customer_mapping(organization_id);
CREATE INDEX IF NOT EXISTS idx_ccm_account
  ON channel_customer_mapping(channel_account_id);
CREATE INDEX IF NOT EXISTS idx_ccm_external
  ON channel_customer_mapping(external_customer_id);
CREATE INDEX IF NOT EXISTS idx_ccm_internal_user
  ON channel_customer_mapping(internal_gov_user_id);
CREATE INDEX IF NOT EXISTS idx_ccm_last_interaction
  ON channel_customer_mapping(last_interaction_at);

-- ============================================================
-- 4. Backfill: 已有 Channel Account 数据回填
-- ============================================================
-- 注意：已有记录的 organizationId 需要管理员手动修正
-- 这里仅做安全默认值处理
UPDATE enterprise_channel_account
  SET organization_id = tenant_id, created_by_gov_user_id = owner_id
  WHERE organization_id IS NULL;

-- 已有 Interaction 数据回填（通过 channelAccountId 关联）
UPDATE enterprise_interaction ei
  SET organization_id = eca.organization_id
  FROM enterprise_channel_account eca
  WHERE ei.channel_account_id = eca.id
  AND ei.organization_id IS NULL;
