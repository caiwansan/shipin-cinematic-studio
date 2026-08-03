-- SPRINT-ECO-04 License & Entitlement Boundary — 生态商业授权（纯新增 3 表，现有表零修改）
-- 原则：只登记授权/只校验不执行 / 不碰 PaymentOrder/Subscription/User/Organization/Agent/Hermes
-- 状态机（掌柜冻结）：subscribe→ACTIVE；ACTIVE→renew→ACTIVE；ACTIVE→expire→EXPIRED；
--                    ACTIVE→suspend→SUSPENDED；SUSPENDED→restore→ACTIVE；EXPIRED→renew→ACTIVE
-- 幂等：IF NOT EXISTS，可重复执行

-- ── ecology_licenses ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_licenses" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "organization_id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "plugin_version" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "license_type" VARCHAR(20) NOT NULL DEFAULT 'subscription',
    "start_at" TIMESTAMP(3) NOT NULL,
    "expire_at" TIMESTAMP(3) NOT NULL,
    "source_subscription_id" TEXT,
    "machine_id" VARCHAR(120),
    "entitlements" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_licenses_pkey" PRIMARY KEY ("id")
);

-- 唯一约束：organization_id + plugin_id 唯一（组织对插件唯一许可，G8 隔离基础）
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_licenses_organization_id_plugin_id_key" ON "ecology_licenses"("organization_id", "plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_licenses_organization_id_idx" ON "ecology_licenses"("organization_id");
CREATE INDEX IF NOT EXISTS "ecology_licenses_plugin_id_idx" ON "ecology_licenses"("plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_licenses_status_idx" ON "ecology_licenses"("status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_licenses_plugin_id_fkey') THEN
    ALTER TABLE "ecology_licenses" ADD CONSTRAINT "ecology_licenses_plugin_id_fkey"
      FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ecology_license_events ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_license_events" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "license_id" TEXT NOT NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "detail" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_license_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ecology_license_events_license_id_idx" ON "ecology_license_events"("license_id");
CREATE INDEX IF NOT EXISTS "ecology_license_events_event_type_idx" ON "ecology_license_events"("event_type");
CREATE INDEX IF NOT EXISTS "ecology_license_events_created_at_idx" ON "ecology_license_events"("created_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_license_events_license_id_fkey') THEN
    ALTER TABLE "ecology_license_events" ADD CONSTRAINT "ecology_license_events_license_id_fkey"
      FOREIGN KEY ("license_id") REFERENCES "ecology_licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── ecology_license_check_logs ────────────────────────────────
CREATE TABLE IF NOT EXISTS "ecology_license_check_logs" (
    "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
    "organization_id" TEXT NOT NULL,
    "plugin_id" TEXT NOT NULL,
    "license_id" TEXT,
    "result" VARCHAR(10) NOT NULL,
    "reason" VARCHAR(60) NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'kaor',
    "machine_id" VARCHAR(120),
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ecology_license_check_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ecology_license_check_logs_organization_id_plugin_id_idx" ON "ecology_license_check_logs"("organization_id", "plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_license_check_logs_license_id_idx" ON "ecology_license_check_logs"("license_id");
CREATE INDEX IF NOT EXISTS "ecology_license_check_logs_checked_at_idx" ON "ecology_license_check_logs"("checked_at");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ecology_license_check_logs_license_id_fkey') THEN
    ALTER TABLE "ecology_license_check_logs" ADD CONSTRAINT "ecology_license_check_logs_license_id_fkey"
      FOREIGN KEY ("license_id") REFERENCES "ecology_licenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
