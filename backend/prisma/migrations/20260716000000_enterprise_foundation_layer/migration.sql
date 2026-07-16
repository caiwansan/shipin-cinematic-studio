-- Sprint 4.2.7: Enterprise Foundation Layer
-- New models: EnterpriseProfile, AIProviderConfig
-- Extends Organization with plan, slug, owner, relations

-- 1. Extend Organization table
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "slug" TEXT UNIQUE;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "owner_id" UUID;
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "plan_expires_at" TIMESTAMP(3);

-- 2. Create EnterpriseProfile table
CREATE TABLE IF NOT EXISTS "enterprise_profile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "industry" TEXT,
    "business_summary" TEXT,
    "target_customer" TEXT,
    "brand_voice" TEXT,
    "website" TEXT,
    "location" TEXT,
    "onboarding_step" INTEGER NOT NULL DEFAULT 0,
    "onboarding_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "enterprise_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "enterprise_profile_organizationId_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "enterprise_profile_organization_id_key" ON "enterprise_profile"("organization_id");

-- 3. Create AIProviderConfig table
CREATE TABLE IF NOT EXISTS "ai_provider_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "base_url" TEXT,
    "model" TEXT NOT NULL,
    "max_tokens_per_day" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_provider_config_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_provider_config_organizationId_fkey"
        FOREIGN KEY ("organization_id") REFERENCES "Organization"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ai_provider_config_org_provider_model_key"
    ON "ai_provider_config"("organization_id", "provider", "model");

-- Note: EnterpriseChannelAccount and EnterpriseInteraction use text-based organizationId
-- (backward compatibility). New foundation models use UUID relation.
