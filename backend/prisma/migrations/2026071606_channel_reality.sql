-- Sprint 4.2.5 — Channel Reality Foundation
-- CTO APPROVED with 5 Contract Freeze
-- Channel: Enterprise WeChat ONLY
-- Date: 2026-07-16

-- ═══════════════════════════════════════════════════════════
-- enterprise_channel_account — 渠道账户（CTO: 凭证必须加密）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_channel_account (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  governance_tenant_id    UUID,
  
  channel_type            TEXT NOT NULL DEFAULT 'wechat_work',
  channel_name            TEXT NOT NULL,
  
  -- 外部账号标识
  external_account_id     TEXT,
  
  -- 凭证（CTO: 禁止明文，必须加密 JSONB）
  credential_encrypted    JSONB NOT NULL DEFAULT '{}'::jsonb,
  connection_status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING/CONNECTED/DISCONNECTED/ERROR
  connected_at            TIMESTAMPTZ,
  last_sync_at            TIMESTAMPTZ,
  last_error              TEXT,
  
  -- 归属
  owner_id                TEXT NOT NULL,
  owner_type              TEXT NOT NULL DEFAULT 'gov_user',
  
  -- 元数据
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_channel_per_tenant UNIQUE (tenant_id, channel_type)
);

CREATE INDEX idx_channel_account_tenant ON enterprise_channel_account(tenant_id);
CREATE INDEX idx_channel_account_gov ON enterprise_channel_account(governance_tenant_id);
CREATE INDEX idx_channel_account_status ON enterprise_channel_account(connection_status);

-- ═══════════════════════════════════════════════════════════
-- enterprise_interaction — 渠道交互事件（新 Event Source）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_interaction (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  governance_tenant_id    UUID,
  
  -- 来源
  channel_type            TEXT NOT NULL DEFAULT 'wechat_work',
  channel_account_id      UUID NOT NULL,
  
  -- 外部客户（CTO: external_id UNIQUE per channel）
  external_id             TEXT NOT NULL,
  external_name           TEXT,
  
  -- 交互内容
  interaction_type        TEXT NOT NULL,  -- message_in / message_out / contact_add / other
  direction               TEXT NOT NULL,  -- inbound / outbound（CTO: 必须区分）
  content                 TEXT,
  content_type            TEXT NOT NULL DEFAULT 'text',  -- text/image/link/event
  
  -- 关联
  action_id               UUID,
  outcome_id              UUID,
  
  -- 信任（CTO: UNVERIFIED → IMPORTED → SYNCED → VERIFIED）
  trust_level             TEXT NOT NULL DEFAULT 'UNVERIFIED',
  
  -- 原始数据
  raw_payload             JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at             TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_interaction_channel FOREIGN KEY (channel_account_id) 
    REFERENCES enterprise_channel_account(id) ON DELETE CASCADE,
  CONSTRAINT fk_interaction_action FOREIGN KEY (action_id) 
    REFERENCES enterprise_action(id) ON DELETE SET NULL,
  CONSTRAINT fk_interaction_outcome FOREIGN KEY (outcome_id) 
    REFERENCES enterprise_outcome(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX idx_interaction_external 
  ON enterprise_interaction(channel_account_id, external_id, interaction_type, occurred_at);
CREATE INDEX idx_interaction_tenant ON enterprise_interaction(tenant_id);
CREATE INDEX idx_interaction_gov ON enterprise_interaction(governance_tenant_id);
CREATE INDEX idx_interaction_channel ON enterprise_interaction(channel_account_id);
CREATE INDEX idx_interaction_action ON enterprise_interaction(action_id);
CREATE INDEX idx_interaction_outcome ON enterprise_interaction(outcome_id);
CREATE INDEX idx_interaction_trust ON enterprise_interaction(trust_level);
CREATE INDEX idx_interaction_occurred ON enterprise_interaction(occurred_at);

-- ═══════════════════════════════════════════════════════════
-- enterprise_channel_sync_log — 同步日志（CTO 增加）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE enterprise_channel_sync_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL,
  channel_account_id      UUID NOT NULL,
  
  sync_type               TEXT NOT NULL DEFAULT 'full',  -- full / incremental
  started_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at             TIMESTAMPTZ,
  status                  TEXT NOT NULL DEFAULT 'running',  -- running / success / partial / failed
  records_synced          INTEGER,
  records_failed          INTEGER,
  error_message           TEXT,
  error_detail            JSONB,
  
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT fk_sync_channel FOREIGN KEY (channel_account_id) 
    REFERENCES enterprise_channel_account(id) ON DELETE CASCADE
);

CREATE INDEX idx_sync_log_tenant ON enterprise_channel_sync_log(tenant_id);
CREATE INDEX idx_sync_log_channel ON enterprise_channel_sync_log(channel_account_id);
CREATE INDEX idx_sync_log_status ON enterprise_channel_sync_log(status);
CREATE INDEX idx_sync_log_started ON enterprise_channel_sync_log(started_at);

-- ═══════════════════════════════════════════════════════════
-- channel_outcome_mapping — 渠道→Outcome 映射（CTO: 仅 PENDING_VERIFY）
-- ═══════════════════════════════════════════════════════════

CREATE TABLE channel_outcome_mapping (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                 UUID NOT NULL,
  channel_type              TEXT NOT NULL DEFAULT 'wechat_work',
  interaction_type          TEXT NOT NULL,
  
  outcome_type              TEXT NOT NULL DEFAULT 'ENGAGEMENT',
  confidence                INTEGER NOT NULL DEFAULT 50,
  
  -- CTO: 默认 human verification
  requires_human_verification BOOLEAN NOT NULL DEFAULT TRUE,
  
  is_active                 BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mapping_tenant ON channel_outcome_mapping(tenant_id);
CREATE INDEX idx_mapping_channel ON channel_outcome_mapping(channel_type);
