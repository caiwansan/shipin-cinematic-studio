-- ============================================================
-- Sprint 12: Tenant Identity Consolidation
-- 数据库版本: 2026.07.28-01
-- 目标：将 Enterprise Recruitment 的租户标识统一为 Organization.organizationId (UUID)
-- ============================================================
-- 迁移对象：
--   1. enterprise_agent_instance: tenant_id TEXT → organization_id UUID (FK → Organization.id)
--   2. enterprise_agent_profile: tenant_id TEXT → organization_id UUID (FK → Organization.id)
--   3. agent_audit_trail: tenant_id TEXT → organization_id UUID (FK → Organization.id)
--   4. usage_logs: 保持 organization_id (已是 UUID，无需迁移)
-- ============================================================

-- ============================================================
-- Step 1: enterprise_agent_instance — 添加 organization_id 列
-- ============================================================
ALTER TABLE enterprise_agent_instance
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 创建索引（先创建，便于回填时查询）
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_instance_org_id
  ON enterprise_agent_instance(organization_id);

-- 回填数据：tenant_id → organization_id（假设 tenant_id 就是 organization 的 UUID 字符串）
UPDATE enterprise_agent_instance
SET organization_id = tenant_id::UUID
WHERE tenant_id IS NOT NULL
  AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 添加外键约束
ALTER TABLE enterprise_agent_instance
  ADD CONSTRAINT fk_enterprise_agent_instance_organization
  FOREIGN KEY (organization_id) REFERENCES "Organization"(id)
  ON DELETE SET NULL;

-- 添加状态和创建时间索引（Phase 6 要求）
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_instance_status
  ON enterprise_agent_instance(status);

CREATE INDEX IF NOT EXISTS idx_enterprise_agent_instance_created_at
  ON enterprise_agent_instance(created_at DESC);

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_instance_org_status
  ON enterprise_agent_instance(organization_id, status);

-- ============================================================
-- Step 2: enterprise_agent_profile — 添加 organization_id 列
-- ============================================================
ALTER TABLE enterprise_agent_profile
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_profile_org_id
  ON enterprise_agent_profile(organization_id);

-- 回填数据
UPDATE enterprise_agent_profile
SET organization_id = tenant_id::UUID
WHERE tenant_id IS NOT NULL
  AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 添加外键约束
ALTER TABLE enterprise_agent_profile
  ADD CONSTRAINT fk_enterprise_agent_profile_organization
  FOREIGN KEY (organization_id) REFERENCES "Organization"(id)
  ON DELETE SET NULL;

-- ============================================================
-- Step 3: agent_audit_trail — 添加 organization_id 列
-- ============================================================
ALTER TABLE agent_audit_trail
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_agent_audit_trail_org_id
  ON agent_audit_trail(organization_id);

-- 回填数据
UPDATE agent_audit_trail
SET organization_id = tenant_id::UUID
WHERE tenant_id IS NOT NULL
  AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 添加外键约束
ALTER TABLE agent_audit_trail
  ADD CONSTRAINT fk_agent_audit_trail_organization
  FOREIGN KEY (organization_id) REFERENCES "Organization"(id)
  ON DELETE SET NULL;

-- Phase 6 要求：agentId + createdAt 复合索引
CREATE INDEX IF NOT EXISTS idx_agent_audit_trail_agent_created
  ON agent_audit_trail(agent_id, created_at DESC);

-- ============================================================
-- Step 4: enterprise_agent_task — 添加 organization_id 列
-- ============================================================
ALTER TABLE enterprise_agent_task
  ADD COLUMN IF NOT EXISTS organization_id UUID;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_task_org_id
  ON enterprise_agent_task(organization_id);

-- 回填数据
UPDATE enterprise_agent_task
SET organization_id = tenant_id::UUID
WHERE tenant_id IS NOT NULL
  AND tenant_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- 添加外键约束
ALTER TABLE enterprise_agent_task
  ADD CONSTRAINT fk_enterprise_agent_task_organization
  FOREIGN KEY (organization_id) REFERENCES "Organization"(id)
  ON DELETE SET NULL;

-- 复合索引
CREATE INDEX IF NOT EXISTS idx_enterprise_agent_task_org_started
  ON enterprise_agent_task(organization_id, started_at DESC);

-- ============================================================
-- Step 5: usage_logs — 确保 organization_id 索引存在
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_usage_logs_org_created
  ON usage_logs(tenant_id, created_at DESC);

-- ============================================================
-- Step 5: 验证迁移结果
-- ============================================================
-- 验证 enterprise_agent_instance
DO $$
DECLARE
  unmapped_count INT;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM enterprise_agent_instance
  WHERE tenant_id IS NOT NULL AND organization_id IS NULL;

  IF unmapped_count > 0 THEN
    RAISE NOTICE 'Warning: % enterprise_agent_instance rows have unmapped tenant_id', unmapped_count;
  ELSE
    RAISE NOTICE 'OK: All enterprise_agent_instance tenant_ids mapped to organization_id';
  END IF;
END $$;

-- 验证 enterprise_agent_profile
DO $$
DECLARE
  unmapped_count INT;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM enterprise_agent_profile
  WHERE tenant_id IS NOT NULL AND organization_id IS NULL;

  IF unmapped_count > 0 THEN
    RAISE NOTICE 'Warning: % enterprise_agent_profile rows have unmapped tenant_id', unmapped_count;
  ELSE
    RAISE NOTICE 'OK: All enterprise_agent_profile tenant_ids mapped to organization_id';
  END IF;
END $$;

-- 验证 agent_audit_trail
DO $$
DECLARE
  unmapped_count INT;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM agent_audit_trail
  WHERE tenant_id IS NOT NULL AND organization_id IS NULL;

  IF unmapped_count > 0 THEN
    RAISE NOTICE 'Warning: % agent_audit_trail rows have unmapped tenant_id', unmapped_count;
  ELSE
    RAISE NOTICE 'OK: All agent_audit_trail tenant_ids mapped to organization_id';
  END IF;
END $$;

-- 验证 enterprise_agent_task
DO $$
DECLARE
  unmapped_count INT;
BEGIN
  SELECT COUNT(*) INTO unmapped_count
  FROM enterprise_agent_task
  WHERE tenant_id IS NOT NULL AND organization_id IS NULL;

  IF unmapped_count > 0 THEN
    RAISE NOTICE 'Warning: % enterprise_agent_task rows have unmapped tenant_id', unmapped_count;
  ELSE
    RAISE NOTICE 'OK: All enterprise_agent_task tenant_ids mapped to organization_id';
  END IF;
END $$;
