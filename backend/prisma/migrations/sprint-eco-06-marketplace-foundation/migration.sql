-- SPRINT-ECO-06 — Marketplace Foundation
-- 新增 2 表（ecology_marketplace_items / ecology_revenue_snapshots）
-- + ecology_plugin_installations 纯扩展 2 列（license_id / removed_at）
-- 纪律：只新增 ecology_*；不碰 Commerce/Subscription/PaymentOrder/工作台；不做商城 UI/支付/推广

-- 1. ecology_marketplace_items — 插件商品登记（LISTED | UNLISTED）
CREATE TABLE IF NOT EXISTS "ecology_marketplace_items" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "plugin_id" TEXT NOT NULL,
  "developer_id" TEXT NOT NULL,
  "display_name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "category" VARCHAR(50),
  "pricing_model" VARCHAR(20) NOT NULL DEFAULT 'FREE',
  "status" VARCHAR(20) NOT NULL DEFAULT 'UNLISTED',
  "listed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_marketplace_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_marketplace_items_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ecology_marketplace_items_developer_id_fkey" FOREIGN KEY ("developer_id") REFERENCES "ecology_developers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_marketplace_items_plugin_id_key" ON "ecology_marketplace_items"("plugin_id");
CREATE INDEX IF NOT EXISTS "ecology_marketplace_items_developer_id_idx" ON "ecology_marketplace_items"("developer_id");
CREATE INDEX IF NOT EXISTS "ecology_marketplace_items_status_idx" ON "ecology_marketplace_items"("status");

-- 2. ecology_plugin_installations 扩展（ECO-06 G2/G3：安装→授权联动；卸载不删行）
ALTER TABLE "ecology_plugin_installations" ADD COLUMN IF NOT EXISTS "license_id" TEXT;
ALTER TABLE "ecology_plugin_installations" ADD COLUMN IF NOT EXISTS "removed_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ecology_plugin_installations_license_id_idx" ON "ecology_plugin_installations"("license_id");

-- 3. ecology_revenue_snapshots — 结算数据快照（非结算：只登记，ECO-07 使用）
CREATE TABLE IF NOT EXISTS "ecology_revenue_snapshots" (
  "id" TEXT NOT NULL DEFAULT (gen_random_uuid()::text),
  "plugin_id" TEXT NOT NULL,
  "period" VARCHAR(7) NOT NULL,
  "subscription_count" INTEGER NOT NULL DEFAULT 0,
  "gross_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'CNY',
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ecology_revenue_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ecology_revenue_snapshots_plugin_id_fkey" FOREIGN KEY ("plugin_id") REFERENCES "ecology_plugins"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ecology_revenue_snapshots_plugin_id_period_key" ON "ecology_revenue_snapshots"("plugin_id", "period");
CREATE INDEX IF NOT EXISTS "ecology_revenue_snapshots_period_idx" ON "ecology_revenue_snapshots"("period");
