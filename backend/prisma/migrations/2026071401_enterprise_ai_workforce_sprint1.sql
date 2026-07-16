-- ============================================================
-- Enterprise AI Workforce Phase 1 - Sprint 1 Migration
-- 数据库版本: 2026.07.14-01 (v2 - 适配 TEXT ID)
-- 依赖: 现有 governance_* 系列表（id 类型为 TEXT）
-- ============================================================

-- ============================================================
-- Layer 1: Enterprise Model Pool（企业模型资源池）
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_llm_config (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id               TEXT NOT NULL,
  provider                VARCHAR(50) NOT NULL,   -- openai/deepseek/aliyun/volcengine/longcat/custom
  model_name              VARCHAR(200) NOT NULL,
  -- 加密存储（AES-256-GCM，由 crypto.service.ts 管理）
  encrypted_api_key       TEXT NOT NULL,
  base_url                TEXT,
  -- 密钥归属
  credential_owner        VARCHAR(30) NOT NULL DEFAULT 'enterprise', -- enterprise/kunlun/user
  -- 配额限制（0=不限）
  max_tokens_per_day      INT DEFAULT 0,
  max_requests_per_minute INT DEFAULT 60,
  -- 能力标签
  capabilities            TEXT DEFAULT '[]',     -- JSON: ["chat","reasoning","long_context","vision"]
  enabled                 BOOLEAN DEFAULT TRUE,
  status                  VARCHAR(20) DEFAULT 'active', -- active/suspended/deprecated
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, provider, model_name)
);

CREATE INDEX idx_enterprise_llm_config_tenant ON enterprise_llm_config(tenant_id, status);

-- ============================================================
-- Agent Profile（企业 AI 员工档案）
-- ============================================================
CREATE TABLE IF NOT EXISTS enterprise_agent_profile (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id               TEXT NOT NULL,
  organization_id         TEXT,
  -- Identity
  name                    VARCHAR(100) NOT NULL,
  avatar_url              TEXT,
  description             TEXT,
  -- Role & Type（role=显示名称，agent_type=系统行为标识）
  role                    VARCHAR(100) NOT NULL,         -- 增长总监/内容经理/客户运营...
  agent_type              VARCHAR(50) NOT NULL,           -- growth_director/content_manager...
  -- Role Definition
  goal                    TEXT,
  knowledge_scope         TEXT DEFAULT '[]',             -- JSON: 知识范围ID列表
  tools                   TEXT DEFAULT '[]',             -- JSON: 工具权限列表
  permissions             TEXT DEFAULT '[]',             -- JSON: 操作权限
  capabilities            TEXT DEFAULT '[]',             -- JSON: 能力标签（用于未来 Marketplace）
  escalation_rules        TEXT,                           -- JSON: 升级规则
  kpi_metrics             TEXT DEFAULT '{}',             -- JSON: KPI指标
  -- Runtime Config
  status                  VARCHAR(20) DEFAULT 'active',   -- active/paused/deactivated
  is_default              BOOLEAN DEFAULT FALSE,          -- 是否为默认创建Agent
  metadata                TEXT DEFAULT '{}',             -- JSON
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enterprise_agent_profile_tenant ON enterprise_agent_profile(tenant_id, status);
CREATE INDEX idx_enterprise_agent_profile_org ON enterprise_agent_profile(organization_id);

-- ============================================================
-- Layer 2: Agent 模型绑定
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_model_binding (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id               TEXT NOT NULL,
  agent_id                TEXT NOT NULL,
  llm_config_id           TEXT NOT NULL,
  task_type               VARCHAR(50) NOT NULL,   -- strategy/content/research/customer/sales/creative
  priority                INT DEFAULT 0,           -- 同 task_type 时高优先
  max_tokens              INT DEFAULT 16384,
  temperature             FLOAT DEFAULT 0.7,
  -- 容错
  fallback_enabled        BOOLEAN DEFAULT TRUE,
  failure_strategy        VARCHAR(30) DEFAULT 'fallback',  -- fallback/retry/pause/notify
  enabled                 BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, llm_config_id, task_type)
);

CREATE INDEX idx_agent_model_binding_agent ON agent_model_binding(agent_id, enabled);
CREATE INDEX idx_agent_model_binding_tenant ON agent_model_binding(tenant_id);

-- ============================================================
-- Layer 3: Model Router Policy（路由策略）
-- ============================================================
CREATE TABLE IF NOT EXISTS model_routing_policy (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id               TEXT NOT NULL,
  organization_id         TEXT,
  agent_type              VARCHAR(50),           -- writer/reviewer/planner/character/director/growth_director...
  task_type               VARCHAR(50) NOT NULL,  -- strategy/content/research/customer/sales/creative
  llm_config_id           TEXT,
  fallback_chain          TEXT DEFAULT '[]',     -- JSON: ["config_id_1","config_id_2","config_id_3"]
  priority                INT DEFAULT 0,
  enabled                 BOOLEAN DEFAULT TRUE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, agent_type, task_type, priority)
);

CREATE INDEX idx_model_routing_policy_tenant ON model_routing_policy(tenant_id, enabled);

-- ============================================================
-- Agent 审计追踪（独立于通用 AuditLog）
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_audit_trail (
  id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id               TEXT NOT NULL,
  agent_id                TEXT,
  task_id                 TEXT,
  action                  VARCHAR(50) NOT NULL,
  resource                VARCHAR(100),
  resource_id             TEXT,
  llm_config_id           TEXT,                   -- 使用的模型
  token_usage             INT DEFAULT 0,
  cost                    FLOAT DEFAULT 0,
  input_summary           TEXT,                   -- 输入摘要（脱敏）
  output_summary          TEXT,                   -- 输出摘要
  duration_ms             INT DEFAULT 0,
  approval_status         VARCHAR(30) DEFAULT 'auto_executed', -- auto_executed/waiting_review/approved/rejected/published
  metadata                TEXT DEFAULT '{}',     -- JSON
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_audit_trail_tenant ON agent_audit_trail(tenant_id, created_at DESC);
CREATE INDEX idx_agent_audit_trail_agent ON agent_audit_trail(agent_id, created_at DESC);

-- ============================================================
-- 现有表改造：governance_organization 扩展
-- ============================================================
ALTER TABLE governance_organization
  ADD COLUMN IF NOT EXISTS department_role VARCHAR(50) DEFAULT 'human'; -- human/ai_department

ALTER TABLE governance_organization
  ADD COLUMN IF NOT EXISTS ai_capabilities TEXT DEFAULT '[]'; -- JSON
