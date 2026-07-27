-- ═══════════════════════════════════════════════════════════════════
-- Phase 3.1.2 — AI Provider Management & Credential Architecture
-- ═══════════════════════════════════════════════════════════════════
-- 企业数字部门控制台 → 配置 API Key → 加密存储 → Gateway 读取

-- 1. 企业 Provider 凭证表（加密存储）
CREATE TABLE IF NOT EXISTS enterprise_provider_credential (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    provider TEXT NOT NULL,                    -- 'deepseek' | 'openai' | 'qwen' | 'doubao'
    model_name TEXT NOT NULL,                  -- 'deepseek-chat' | 'gpt-4o'
    api_key_encrypted TEXT NOT NULL,           -- AES-256-GCM 加密
    api_key_iv TEXT NOT NULL,                  -- 初始化向量
    api_key_tag TEXT NOT NULL,                 -- GCM 认证标签
    base_url TEXT,                             -- 自定义 Base URL
    is_default BOOLEAN DEFAULT false,          -- 组织默认 Provider
    status TEXT DEFAULT 'active',              -- 'active' | 'disabled' | 'revoked'
    last_health_check TIMESTAMP WITH TIME ZONE,
    health_status TEXT DEFAULT 'unknown',      -- 'healthy' | 'degraded' | 'error'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT,
    UNIQUE(organization_id, provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_epc_org ON enterprise_provider_credential(organization_id);
CREATE INDEX IF NOT EXISTS idx_epc_tenant ON enterprise_provider_credential(tenant_id);
CREATE INDEX IF NOT EXISTS idx_epc_provider ON enterprise_provider_credential(provider);
CREATE INDEX IF NOT EXISTS idx_epc_status ON enterprise_provider_credential(status);

-- 2. Agent-Model 绑定表
CREATE TABLE IF NOT EXISTS enterprise_agent_model_binding (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,                    -- enterprise_agent_profile.id
    credential_id TEXT NOT NULL,               -- enterprise_provider_credential.id
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    reasoning_mode TEXT DEFAULT 'analytical',  -- 'analytical' | 'creative' | 'balanced'
    is_default BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, provider, model_name)
);

CREATE INDEX IF NOT EXISTS idx_eamb_org ON enterprise_agent_model_binding(organization_id);
CREATE INDEX IF NOT EXISTS idx_eamb_agent ON enterprise_agent_model_binding(agent_id);
CREATE INDEX IF NOT EXISTS idx_eamb_credential ON enterprise_agent_model_binding(credential_id);
CREATE INDEX IF NOT EXISTS idx_eamb_status ON enterprise_agent_model_binding(status);

-- 3. 扩展现有 audit trail — 记录 Provider 调用成本归属
ALTER TABLE agent_audit_trail 
ADD COLUMN IF NOT EXISTS credential_id TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS agent_id_target TEXT DEFAULT '';  -- 区别于 workflow 的 agent_id

CREATE INDEX IF NOT EXISTS idx_aat_credential ON agent_audit_trail(credential_id);
CREATE INDEX IF NOT EXISTS idx_aat_provider ON agent_audit_trail(provider);

-- 4. Provider 调用计费表（Agent 维度）
CREATE TABLE IF NOT EXISTS enterprise_provider_usage (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id TEXT NOT NULL DEFAULT '',
    organization_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    credential_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    call_type TEXT NOT NULL,                   -- 'brain' | 'workflow' | 'tool'
    token_input INTEGER DEFAULT 0,
    token_output INTEGER DEFAULT 0,
    cost FLOAT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_epu_org ON enterprise_provider_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_epu_agent ON enterprise_provider_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_epu_credential ON enterprise_provider_usage(credential_id);
CREATE INDEX IF NOT EXISTS idx_epu_created ON enterprise_provider_usage(created_at);
