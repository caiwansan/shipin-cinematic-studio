-- SPRINT-ECO-11.3 — Local Plugin Runtime（设备 ↔ 插件运行时实例）
-- 掌柜冻结（2026-08-04）：本地 = 入口 + 状态管理；云端 = AI 执行真相
-- ❌ 不存授权结论（licenseStatus/allowed/permissionResult 属于 License 系统）
-- ❌ 本地零代码执行（本表只记录生命周期，不承载任何执行语义）
CREATE TABLE IF NOT EXISTS "ecology_local_plugin_runtime" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'INSTALLED',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "last_heartbeat" TIMESTAMP(3),
    "stopped_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_local_plugin_runtime_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_local_plugin_runtime_device_id_plugin_id_key"
    ON "ecology_local_plugin_runtime"("device_id", "plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_local_plugin_runtime_organization_id_idx"
    ON "ecology_local_plugin_runtime"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_local_plugin_runtime_plugin_id_idx"
    ON "ecology_local_plugin_runtime"("plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_local_plugin_runtime_last_heartbeat_idx"
    ON "ecology_local_plugin_runtime"("last_heartbeat");

-- 外键：设备级联删除（吊销/注销设备时运行时记录一并清理）；插件存在性约束
ALTER TABLE "ecology_local_plugin_runtime" DROP CONSTRAINT IF EXISTS "ecology_local_plugin_runtime_device_id_fkey";
ALTER TABLE "ecology_local_plugin_runtime" ADD CONSTRAINT "ecology_local_plugin_runtime_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "ecology_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ecology_local_plugin_runtime" DROP CONSTRAINT IF EXISTS "ecology_local_plugin_runtime_plugin_id_fkey";
ALTER TABLE "ecology_local_plugin_runtime" ADD CONSTRAINT "ecology_local_plugin_runtime_plugin_id_fkey"
    FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
