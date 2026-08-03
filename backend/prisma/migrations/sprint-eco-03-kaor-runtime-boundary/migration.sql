-- SPRINT-ECO-03 KAOR Runtime Boundary — 纯新增 3 张 ecology_runtime* 表（幂等）
-- 纪律：只登记 Runtime 身份/能力/映射；不修改任何现有表

-- 1. ecology_runtimes: Runtime 身份注册表
CREATE TABLE IF NOT EXISTS "ecology_runtimes" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "runtime_id" VARCHAR(50) NOT NULL UNIQUE,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "version" VARCHAR(30) NOT NULL,
  "adapter" VARCHAR(50) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "ecology_runtimes_status_idx" ON "ecology_runtimes" ("status");

-- 2. ecology_runtime_capabilities: 能力注册表（runtime 能力声明）
CREATE TABLE IF NOT EXISTS "ecology_runtime_capabilities" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "runtime_id" TEXT NOT NULL REFERENCES "ecology_runtimes"("id") ON DELETE CASCADE,
  "capability" VARCHAR(60) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ecology_runtime_capabilities_runtime_id_capability_key" UNIQUE ("runtime_id", "capability")
);
CREATE INDEX IF NOT EXISTS "ecology_runtime_capabilities_capability_idx" ON "ecology_runtime_capabilities" ("capability");

-- 3. ecology_plugin_runtime_bindings: 插件 ↔ Runtime 能力映射（G4 验证点）
CREATE TABLE IF NOT EXISTS "ecology_plugin_runtime_bindings" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "plugin_id" TEXT NOT NULL REFERENCES "ecology_plugins"("id") ON DELETE CASCADE,
  "runtime_id" TEXT NOT NULL REFERENCES "ecology_runtimes"("id") ON DELETE CASCADE,
  "capabilities" TEXT NOT NULL DEFAULT '[]',
  "status" VARCHAR(20) NOT NULL DEFAULT 'bound',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "ecology_plugin_runtime_bindings_plugin_id_runtime_id_key" UNIQUE ("plugin_id", "runtime_id")
);
CREATE INDEX IF NOT EXISTS "ecology_plugin_runtime_bindings_plugin_id_idx" ON "ecology_plugin_runtime_bindings" ("plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_plugin_runtime_bindings_runtime_id_idx" ON "ecology_plugin_runtime_bindings" ("runtime_id");
