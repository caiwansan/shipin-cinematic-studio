-- BETA-ARCH-03.0.2 Step 2: MigrationUsageLog telemetry table
-- Purpose: Legacy Adapter Usage Tracking
-- Phase: Telemetry foundation for Architecture Sentinel (BETA-ARCH-03.0.3)

CREATE TABLE "migration_usage_log" (
  "id"        TEXT PRIMARY KEY,
  "adapter"   TEXT,
  "caller"    TEXT,
  "source"    TEXT NOT NULL,
  "target"    TEXT NOT NULL,
  "status"    TEXT NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "call_count" INTEGER NOT NULL DEFAULT 1,
  "metadata"  JSONB,
  "created_at" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX "migration_usage_log_source_target_idx" ON "migration_usage_log" ("source", "target");
CREATE INDEX "migration_usage_log_adapter_idx" ON "migration_usage_log" ("adapter");
CREATE INDEX "migration_usage_log_created_at_idx" ON "migration_usage_log" ("created_at");
