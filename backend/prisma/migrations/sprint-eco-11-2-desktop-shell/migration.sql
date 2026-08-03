-- SPRINT-ECO-11.2 — Kunlun Desktop Shell（设备层）
-- 掌柜冻结（2026-08-04）：B 设备级授权 MVP；设备指纹 = 随机 device_id + 签名 token + 用户确认
-- ❌ 禁止硬件绑定（CPU/硬盘/MAC 序列号）；只新增 ecology_* 表
CREATE TABLE IF NOT EXISTS "ecology_devices" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "device_id" VARCHAR(80) NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_name" VARCHAR(120),
    "device_fingerprint" VARCHAR(200) NOT NULL,
    "os" VARCHAR(60),
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "device_token_hash" VARCHAR(128) NOT NULL,
    "last_heartbeat" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_devices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_devices_device_id_key" ON "ecology_devices"("device_id");
CREATE INDEX IF NOT EXISTS "ecology_devices_organization_id_idx" ON "ecology_devices"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_devices_user_id_idx" ON "ecology_devices"("user_id");

CREATE TABLE IF NOT EXISTS "ecology_local_apps" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "install_path" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'INSTALLED',
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_local_apps_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_local_apps_device_id_application_id_key" ON "ecology_local_apps"("device_id", "application_id");
CREATE INDEX IF NOT EXISTS "ecology_local_apps_organization_id_idx" ON "ecology_local_apps"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_local_apps_application_id_idx" ON "ecology_local_apps"("application_id");

-- 外键：设备级联删除（吊销/注销设备时本地应用记录一并清理）
ALTER TABLE "ecology_local_apps" DROP CONSTRAINT IF EXISTS "ecology_local_apps_device_id_fkey";
ALTER TABLE "ecology_local_apps" ADD CONSTRAINT "ecology_local_apps_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "ecology_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
