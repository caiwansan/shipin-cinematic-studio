-- Sprint-03: Enterprise Commercial Reality Fix
-- 1. Create enterprise_entitlement table
-- 2. Add tenant_id to usage_logs
-- 3. Add snapshot fields to enterprise_subscription

-- ============================================================
-- 1. EnterpriseEntitlement 表
-- ============================================================
CREATE TABLE IF NOT EXISTS "enterprise_entitlement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "max_agents" INTEGER NOT NULL DEFAULT 1,
    "max_channels" INTEGER NOT NULL DEFAULT 1,
    "max_members" INTEGER NOT NULL DEFAULT 3,
    "storage_limit_gb" INTEGER NOT NULL DEFAULT 5,
    "features" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "effective_from" TIMESTAMP NOT NULL DEFAULT NOW(),
    "effective_until" TIMESTAMP,
    "override_reason" TEXT,
    "override_by" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT "enterprise_entitlement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "enterprise_entitlement_subscription_id_key" UNIQUE ("subscription_id"),
    CONSTRAINT "enterprise_entitlement_organization_id_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE CASCADE,
    CONSTRAINT "enterprise_entitlement_subscription_id_fkey"
        FOREIGN KEY ("subscription_id") REFERENCES "enterprise_subscription"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "enterprise_entitlement_organization_id_idx"
    ON "enterprise_entitlement"("organization_id");
CREATE INDEX IF NOT EXISTS "enterprise_entitlement_status_idx"
    ON "enterprise_entitlement"("status");

-- ============================================================
-- 2. UsageLog 添加 tenant_id
-- ============================================================
ALTER TABLE "usage_logs"
    ADD COLUMN IF NOT EXISTS "tenant_id" UUID;

CREATE INDEX IF NOT EXISTS "usage_logs_tenant_id_idx"
    ON "usage_logs"("tenant_id");

-- ============================================================
-- 3. EnterpriseSubscription 添加 snapshot 字段
-- ============================================================
ALTER TABLE "enterprise_subscription"
    ADD COLUMN IF NOT EXISTS "snapshot_name" TEXT,
    ADD COLUMN IF NOT EXISTS "snapshot_max_employees" INTEGER,
    ADD COLUMN IF NOT EXISTS "snapshot_max_channels" INTEGER,
    ADD COLUMN IF NOT EXISTS "snapshot_max_members" INTEGER,
    ADD COLUMN IF NOT EXISTS "snapshot_features" JSONB;
