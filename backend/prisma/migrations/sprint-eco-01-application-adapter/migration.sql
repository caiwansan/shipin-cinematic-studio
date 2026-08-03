-- SPRINT-ECO-01 — Application Adapter Layer（应用身份抽象层）
-- 生态身份证系统：现有工作台通过 Application Adapter 获得应用身份，零业务改动。
-- 纯新增表（ecology_ 前缀），不修改任何现有表。回滚 = 逆序 DROP 本文件 4 表。

-- 1. 应用注册表
CREATE TABLE IF NOT EXISTS "ecology_applications" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "icon" TEXT,
  "description" TEXT,
  "category" VARCHAR(30) NOT NULL,
  "author_org_id" TEXT,
  "is_platform_built_in" BOOLEAN NOT NULL DEFAULT true,
  "status" VARCHAR(30) NOT NULL DEFAULT 'BUILT_IN',
  "lifecycle_state" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "workspace_entry" TEXT,
  "backend_module" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_applications_slug_key" ON "ecology_applications"("slug");
CREATE INDEX IF NOT EXISTS "ecology_applications_category_idx" ON "ecology_applications"("category");
CREATE INDEX IF NOT EXISTS "ecology_applications_status_idx" ON "ecology_applications"("status");

-- 2. 应用版本表
CREATE TABLE IF NOT EXISTS "ecology_application_versions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "application_id" TEXT NOT NULL,
  "version" VARCHAR(30) NOT NULL,
  "changelog" TEXT,
  "frontend_entry" TEXT,
  "backend_module" TEXT,
  "schema_version" TEXT,
  "min_platform_version" TEXT,
  "manifest" JSONB NOT NULL DEFAULT '{}',
  "status" VARCHAR(30) NOT NULL DEFAULT 'released',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_application_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_application_versions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "ecology_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_application_versions_application_id_version_key" ON "ecology_application_versions"("application_id", "version");
CREATE INDEX IF NOT EXISTS "ecology_application_versions_application_id_idx" ON "ecology_application_versions"("application_id");

-- 3. 租户安装表
CREATE TABLE IF NOT EXISTS "ecology_application_installations" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "organization_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "version_id" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
  "lifecycle_state" VARCHAR(30) NOT NULL DEFAULT 'INSTALLED',
  "config" JSONB DEFAULT '{}',
  "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_used_at" TIMESTAMP(3),
  CONSTRAINT "ecology_application_installations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_application_installations_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "ecology_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ecology_application_installations_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "ecology_application_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_application_installations_org_app_key" ON "ecology_application_installations"("organization_id", "application_id");
CREATE INDEX IF NOT EXISTS "ecology_application_installations_org_idx" ON "ecology_application_installations"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_application_installations_app_idx" ON "ecology_application_installations"("application_id");

-- 4. 应用权限表
CREATE TABLE IF NOT EXISTS "ecology_application_permissions" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "install_id" TEXT NOT NULL,
  "permission" VARCHAR(50) NOT NULL,
  "granted_by" TEXT,
  "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  CONSTRAINT "ecology_application_permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_application_permissions_install_id_fkey" FOREIGN KEY ("install_id") REFERENCES "ecology_application_installations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "ecology_application_permissions_install_idx" ON "ecology_application_permissions"("install_id");
CREATE INDEX IF NOT EXISTS "ecology_application_permissions_permission_idx" ON "ecology_application_permissions"("permission");
