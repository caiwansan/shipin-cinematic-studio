-- Beta-01 Security Hardening Sprint — BUG-03 Prisma Migration
-- 修复: 补全手工 DDL 变更到 migration 历史

-- 1. enterprise_content_publish 表（之前手工创建）
CREATE TABLE IF NOT EXISTS "enterprise_content_publish" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" VARCHAR(255),
    "platform" VARCHAR(50),
    "status" VARCHAR(50) DEFAULT 'draft',
    "created_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enterprise_content_publish_pkey" PRIMARY KEY ("id")
);

-- 2. enterprise_profile.id 默认值（之前手工 ALTER）
-- 注意: 仅当列没有默认值时执行
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_attrdef ad
        JOIN pg_attribute a ON a.attrelid = ad.adrelid AND a.attnum = ad.adnum
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'enterprise_profile' AND a.attname = 'id'
    ) THEN
        ALTER TABLE "enterprise_profile" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    END IF;
END
$$;

-- 3. 订阅唯一约束（BUG-05 竞态条件防护）
-- 确保同一组织不能有多个 pending/active 订阅
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_subscription_org_active"
    ON "enterprise_subscription" ("organization_id")
    WHERE status IN ('pending', 'active');

-- 4. 同步 govOrganization → Organization（确保 FK 约束一致）
-- 仅插入不存在的记录
INSERT INTO "Organization" ("id", "name", "createdAt", "updatedAt")
SELECT go.id::uuid, go.name, go."createdAt", go."updatedAt"
FROM "governance_organization" go
LEFT JOIN "Organization" o ON o.id = go.id::uuid
WHERE o.id IS NULL
ON CONFLICT ("id") DO NOTHING;
