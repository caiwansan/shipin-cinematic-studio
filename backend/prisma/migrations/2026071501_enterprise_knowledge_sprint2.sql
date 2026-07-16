-- Phase 3.5 Sprint 2 — Knowledge & Approval Layer
-- Date: 2026-07-15
-- 修正: enterprise_knowledge增加agent_access_scope, enterprise_content_publish增加审批链追踪

-- ========== 1. 新增 enterprise_knowledge 表 ==========
CREATE TABLE IF NOT EXISTS enterprise_knowledge (
  id              TEXT PRIMARY KEY,
  tenant_id       TEXT NOT NULL,
  type            VARCHAR(30) NOT NULL,       -- intro|product|case|script|faq|industry
  title           VARCHAR(200) NOT NULL,
  content         TEXT NOT NULL,              -- 正文内容 (Markdown)
  file_url        TEXT,                       -- 可选文件附件
  source          VARCHAR(50) DEFAULT 'upload',
  status          VARCHAR(20) DEFAULT 'active', -- active|archived
  char_count      INT DEFAULT 0,
  agent_access_scope TEXT DEFAULT '[]',        -- 修正1: 控制Agent访问范围
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enterprise_knowledge_tenant ON enterprise_knowledge(tenant_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_knowledge_type ON enterprise_knowledge(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_enterprise_knowledge_status ON enterprise_knowledge(tenant_id, status);

-- ========== 2. 扩展 enterprise_content_publish 表 ==========
DO $$
BEGIN
  -- 修正3: Agent身份绑定
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'generated_by_agent_id') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN generated_by_agent_id TEXT;
  END IF;
  -- 修正2: 增加revision_required追踪
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'review_status') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN review_status VARCHAR(30);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'revision_count') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN revision_count INT DEFAULT 0;
  END IF;
  -- 审批链条
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'approver_id') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN approver_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'approval_at') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN approval_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'approval_note') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN approval_note TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'ai_review_score') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN ai_review_score INT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'enterprise_content_publish' AND column_name = 'ai_review_note') THEN
    ALTER TABLE enterprise_content_publish ADD COLUMN ai_review_note TEXT;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_enterprise_content_publish_status ON enterprise_content_publish(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_enterprise_content_publish_agent ON enterprise_content_publish(tenant_id, generated_by_agent_id);
