-- P4.2.5.2-IMP-01.4: Customer Identity Sync
-- 1. Add mappingStatus to ChannelCustomerMapping
-- 2. Create CustomerIdentity table
-- 3. Add customerIdentityId to EnterpriseInteraction

-- ─── 1. ChannelCustomerMapping: Add mapping_status ────────

ALTER TABLE "channel_customer_mapping"
    ADD COLUMN IF NOT EXISTS "mapping_status" TEXT NOT NULL DEFAULT 'unknown';

CREATE INDEX IF NOT EXISTS "channel_customer_mapping_mapping_status_idx"
    ON "channel_customer_mapping"("mapping_status");

-- Backfill existing rows
UPDATE "channel_customer_mapping"
SET "mapping_status" = CASE
    WHEN "internal_customer_id" IS NOT NULL THEN 'mapped'
    WHEN "internal_gov_user_id" IS NOT NULL THEN 'pending'
    ELSE 'unknown'
END
WHERE "mapping_status" = 'unknown';

-- ─── 2. EnterpriseInteraction: Add customer_identity_id ──

ALTER TABLE "enterprise_interaction"
    ADD COLUMN IF NOT EXISTS "customer_identity_id" TEXT;

CREATE INDEX IF NOT EXISTS "enterprise_interaction_customer_identity_id_idx"
    ON "enterprise_interaction"("customer_identity_id");

-- ─── 2. CustomerIdentity (Canonical Customer Table) ───────

CREATE TABLE IF NOT EXISTS "customer_identity" (
    "id"                TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id"         TEXT NOT NULL,
    "governance_tenant_id" TEXT,
    "organization_id"   TEXT,

    "internal_customer_id" TEXT,
    "internal_gov_user_id" TEXT,

    "display_name"      TEXT NOT NULL,
    "display_avatar"    TEXT,

    "channel_type"      TEXT NOT NULL,
    "channel_account_id" TEXT NOT NULL,
    "external_id"       TEXT NOT NULL,
    "external_open_id"  TEXT,

    "mapping_status"    TEXT NOT NULL DEFAULT 'unknown',

    "first_interaction_at" TIMESTAMP(3),
    "last_interaction_at"  TIMESTAMP(3),
    "interaction_count"    INTEGER NOT NULL DEFAULT 0,

    "last_synced_at"    TIMESTAMP(3),
    "sync_source"       TEXT,

    "metadata"          JSONB NOT NULL DEFAULT '{}',

    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_identity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_identity_tenant_id_channel_type_external_id_key"
    ON "customer_identity"("tenant_id", "channel_type", "external_id");

CREATE INDEX IF NOT EXISTS "customer_identity_tenant_id_idx" ON "customer_identity"("tenant_id");
CREATE INDEX IF NOT EXISTS "customer_identity_governance_tenant_id_idx" ON "customer_identity"("governance_tenant_id");
CREATE INDEX IF NOT EXISTS "customer_identity_organization_id_idx" ON "customer_identity"("organization_id");
CREATE INDEX IF NOT EXISTS "customer_identity_channel_account_id_idx" ON "customer_identity"("channel_account_id");
CREATE INDEX IF NOT EXISTS "customer_identity_internal_customer_id_idx" ON "customer_identity"("internal_customer_id");
CREATE INDEX IF NOT EXISTS "customer_identity_internal_gov_user_id_idx" ON "customer_identity"("internal_gov_user_id");
CREATE INDEX IF NOT EXISTS "customer_identity_mapping_status_idx" ON "customer_identity"("mapping_status");
CREATE INDEX IF NOT EXISTS "customer_identity_external_id_idx" ON "customer_identity"("external_id");
CREATE INDEX IF NOT EXISTS "customer_identity_last_interaction_at_idx" ON "customer_identity"("last_interaction_at");
