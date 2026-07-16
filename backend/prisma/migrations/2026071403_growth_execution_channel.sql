-- Phase 3: Growth Execution Layer — Channel Gateway
-- 新增：enterprise_channel_account / enterprise_content_publish / enterprise_interaction

CREATE TABLE IF NOT EXISTS enterprise_channel_account (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    platform VARCHAR(30) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    encrypted_credential TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'connected',
    follower_count INTEGER NOT NULL DEFAULT 0,
    verified BOOLEAN NOT NULL DEFAULT false,
    last_health_check TIMESTAMPTZ,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, platform, account_name)
);

CREATE INDEX IF NOT EXISTS idx_channel_account_tenant_status ON enterprise_channel_account(tenant_id, status);

CREATE TABLE IF NOT EXISTS enterprise_content_publish (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    channel_account_id TEXT NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    images TEXT NOT NULL DEFAULT '[]',
    platform VARCHAR(30) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    publish_time TIMESTAMPTZ,
    platform_post_id TEXT,
    platform_url TEXT,
    interaction_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    rejection_reason TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_publish_tenant_status ON enterprise_content_publish(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_content_publish_tenant_platform_time ON enterprise_content_publish(tenant_id, platform, publish_time);

CREATE TABLE IF NOT EXISTS enterprise_interaction (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    channel_account_id TEXT NOT NULL,
    content_publish_id TEXT,
    platform_user_id TEXT NOT NULL,
    platform VARCHAR(30) NOT NULL,
    type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    intent_score INTEGER NOT NULL DEFAULT 0,
    lead_status VARCHAR(20) NOT NULL DEFAULT 'cold',
    replied BOOLEAN NOT NULL DEFAULT false,
    reply_content TEXT,
    replied_at TIMESTAMPTZ,
    raw_data TEXT NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interaction_tenant_type ON enterprise_interaction(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_interaction_tenant_lead ON enterprise_interaction(tenant_id, lead_status);

-- Comments
COMMENT ON TABLE enterprise_channel_account IS '企业渠道账号（微信公众号/抖音/小红书/快手/企微）';
COMMENT ON TABLE enterprise_content_publish IS '内容发布记录（Phase 3 Growth Execution Layer）';
COMMENT ON TABLE enterprise_interaction IS '用户互动（评论/私信/点赞等）';
