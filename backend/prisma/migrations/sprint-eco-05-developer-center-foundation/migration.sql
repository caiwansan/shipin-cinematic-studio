-- SPRINT-ECO-05 — Developer Center Foundation
-- 纯新增 3 表：ecology_developers / ecology_plugin_publish_requests / ecology_developer_agreements
-- 纪律：不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes；不碰 ecology_* 既有表结构

-- 1. ecology_developers — 开发者身份（CREATED | VERIFIED | SUSPENDED）
CREATE TABLE IF NOT EXISTS "ecology_developers" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "developer_id" VARCHAR(64) NOT NULL,
  "user_id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "developer_name" VARCHAR(100) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'CREATED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_developers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_developers_developer_id_key" UNIQUE ("developer_id"),
  CONSTRAINT "ecology_developers_user_id_key" UNIQUE ("user_id")
);
CREATE INDEX IF NOT EXISTS "ecology_developers_organization_id_idx" ON "ecology_developers"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_developers_status_idx" ON "ecology_developers"("status");

-- 2. ecology_plugin_publish_requests — 插件发布申请（DRAFT | SUBMITTED | APPROVED | REJECTED）
CREATE TABLE IF NOT EXISTS "ecology_plugin_publish_requests" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "plugin_id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "developer_id" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "review_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_plugin_publish_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_plugin_publish_requests_plugin_id_version_id_key" UNIQUE ("plugin_id", "version_id"),
  CONSTRAINT "ecology_plugin_publish_requests_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE,
  CONSTRAINT "ecology_plugin_publish_requests_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ecology_plugin_versions"("id") ON DELETE CASCADE,
  CONSTRAINT "ecology_plugin_publish_requests_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "ecology_developers"("id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "ecology_plugin_publish_requests_developer_id_idx" ON "ecology_plugin_publish_requests"("developer_id");
CREATE INDEX IF NOT EXISTS "ecology_plugin_publish_requests_status_idx" ON "ecology_plugin_publish_requests"("status");

-- 3. ecology_developer_agreements — 开发者协议记录（分成 / IP / 插件责任留痕）
CREATE TABLE IF NOT EXISTS "ecology_developer_agreements" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "developer_id" TEXT NOT NULL,
  "agreement_type" VARCHAR(30) NOT NULL,
  "version" VARCHAR(30) NOT NULL,
  "content" TEXT,
  "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(20) NOT NULL DEFAULT 'SIGNED',
  CONSTRAINT "ecology_developer_agreements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_developer_agreements_developer_id_agreement_type_version_key" UNIQUE ("developer_id", "agreement_type", "version"),
  CONSTRAINT "ecology_developer_agreements_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "ecology_developers"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ecology_developer_agreements_developer_id_idx" ON "ecology_developer_agreements"("developer_id");
