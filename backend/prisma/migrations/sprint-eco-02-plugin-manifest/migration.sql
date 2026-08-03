-- SPRINT-ECO-02 Plugin Manifest Runtime — 插件身份系统（纯新增 3 表，现有表零修改）
-- 原则：只登记不执行 / 不运行第三方代码 / 不接入支付
-- 幂等：IF NOT EXISTS，可重复执行

-- ── ecology_plugins ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_plugins" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "plugin_id" VARCHAR(80) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "author" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "application_id" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'REGISTERED',
    "lifecycle_state" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "manifest" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_plugins_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：plugin_id 全局唯一（重复 id 防线）
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_plugins_plugin_id_key" ON "ecology_plugins"("plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_plugins_type_idx" ON "ecology_plugins"("type");
CREATE INDEX IF NOT EXISTS "ecology_plugins_application_id_idx" ON "ecology_plugins"("application_id");

-- 外键：application 关联 ecology_applications（可选，SetNull 不阻断插件登记）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_plugins_application_id_fkey') THEN
    ALTER TABLE "ecology_plugins" ADD CONSTRAINT "ecology_plugins_application_id_fkey"
      FOREIGN KEY ("application_id") REFERENCES "ecology_applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ecology_plugin_versions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_plugin_versions" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "plugin_id" TEXT NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "changelog" TEXT,
    "schema_version" VARCHAR(30),
    "manifest" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "status" VARCHAR(20) NOT NULL DEFAULT 'published',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_plugin_versions_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：plugin_id + version 唯一（版本升级防线）
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_plugin_versions_plugin_id_version_key" ON "ecology_plugin_versions"("plugin_id", "version");
CREATE INDEX IF NOT EXISTS "ecology_plugin_versions_plugin_id_idx" ON "ecology_plugin_versions"("plugin_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_plugin_versions_plugin_id_fkey') THEN
    ALTER TABLE "ecology_plugin_versions" ADD CONSTRAINT "ecology_plugin_versions_plugin_id_fkey"
      FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ecology_plugin_installations ────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_plugin_installations" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "organization_id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "version_id" TEXT,
    "status" VARCHAR(30) NOT NULL DEFAULT 'INSTALLED',
    "lifecycle_state" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB DEFAULT '{}'::jsonb,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    CONSTRAINT "ecology_plugin_installations_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：organization_id + plugin_id 唯一（组织安装幂等）
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_plugin_installations_organization_id_plugin_id_key" ON "ecology_plugin_installations"("organization_id", "plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_plugin_installations_organization_id_idx" ON "ecology_plugin_installations"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_plugin_installations_plugin_id_idx" ON "ecology_plugin_installations"("plugin_id");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_plugin_installations_plugin_id_fkey') THEN
    ALTER TABLE "ecology_plugin_installations" ADD CONSTRAINT "ecology_plugin_installations_plugin_id_fkey"
      FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_plugin_installations_version_id_fkey') THEN
    ALTER TABLE "ecology_plugin_installations" ADD CONSTRAINT "ecology_plugin_installations_version_id_fkey"
      FOREIGN KEY ("version_id") REFERENCES "ecology_plugin_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
