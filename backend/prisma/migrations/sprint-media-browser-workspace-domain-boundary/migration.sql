-- SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 Domain Boundary Fix
-- 业务域隔离：AI 员工 + Browser Workspace 必须属于业务部门（career/media/ecommerce/legal）
-- 禁止跨域绑定渠道：招聘 AI 不得登录抖音；法律 AI 不得打开淘宝
--
-- 1. enterprise_agent_profile 增加 business_type（默认 career，兼容存量）
-- 2. browser_workspace 增加 business_type（默认 media，兼容存量抖音工作空间）
-- 3. 存量回填：
--    - career 域：career_advisor / recruiter / interview / talent_analyst / talent_agent
--    - media 域：content_creator / hotspot_analyst / marketing / novel_editor / drama_director
--    - legal 域：legal_advisor
-- 4. browser_workspace 组合索引 (organization_id, business_type)

ALTER TABLE "enterprise_agent_profile"
  ADD COLUMN IF NOT EXISTS "business_type" VARCHAR(30) NOT NULL DEFAULT 'career';

ALTER TABLE "browser_workspace"
  ADD COLUMN IF NOT EXISTS "business_type" VARCHAR(30) NOT NULL DEFAULT 'media';

-- 存量 profile 回填业务域（按 agent_type 映射）
UPDATE "enterprise_agent_profile" SET "business_type" = 'media'
WHERE "agent_type" IN ('content_creator', 'hotspot_analyst', 'marketing', 'novel_editor', 'drama_director');

UPDATE "enterprise_agent_profile" SET "business_type" = 'legal'
WHERE "agent_type" = 'legal_advisor';

-- 存量 workspace 回填：全部为抖音渠道 → media 域
UPDATE "browser_workspace" SET "business_type" = 'media';

-- 组合索引（查询必须 organizationId + businessType）
CREATE INDEX IF NOT EXISTS "browser_workspace_organization_business_idx"
  ON "browser_workspace" ("organization_id", "business_type");

CREATE INDEX IF NOT EXISTS "enterprise_agent_profile_business_type_idx"
  ON "enterprise_agent_profile" ("business_type");
