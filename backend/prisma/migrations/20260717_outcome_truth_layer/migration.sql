-- OI-01 Schema Foundation — Outcome Truth Layer v1.0
-- P0-4-2-4 Outcome Intelligence Phase
-- Isolation Key: organizationId (Enterprise Identity Boundary v1.0)
-- 2026-07-17

-- ═══════════════════════════════════════════════════════════════
-- outcome_record: 记录 Action 执行后产生的可验证结果
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "outcome_record" (
    "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "action_id"     TEXT,
    "agent_id"      TEXT,
    "outcome_type"  TEXT NOT NULL DEFAULT 'OPERATIONAL',
    "outcome_status" TEXT NOT NULL DEFAULT 'PENDING_VERIFY',
    "description"   TEXT,
    "evidence"      JSONB NOT NULL DEFAULT '[]',
    "occurred_at"   TIMESTAMPTZ,
    "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "outcome_record_organization_id_idx" ON "outcome_record" ("organization_id");
CREATE INDEX "outcome_record_action_id_idx" ON "outcome_record" ("action_id");
CREATE INDEX "outcome_record_agent_id_idx" ON "outcome_record" ("agent_id");
CREATE INDEX "outcome_record_organization_id_status_idx" ON "outcome_record" ("organization_id", "outcome_status");
CREATE INDEX "outcome_record_outcome_type_idx" ON "outcome_record" ("outcome_type");
CREATE INDEX "outcome_record_occurred_at_idx" ON "outcome_record" ("occurred_at");

-- ═══════════════════════════════════════════════════════════════
-- impact_measurement: Outcome 对企业产生的价值
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "impact_measurement" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "outcome_id"      TEXT NOT NULL REFERENCES "outcome_record"("id") ON DELETE CASCADE,
    "metric_type"     TEXT NOT NULL,
    "metric_value"    TEXT NOT NULL,
    "unit"            TEXT NOT NULL DEFAULT 'count',
    "metadata"        JSONB NOT NULL DEFAULT '{}',
    "source"          TEXT,
    "verified_at"     TIMESTAMPTZ,
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "impact_measurement_organization_id_idx" ON "impact_measurement" ("organization_id");
CREATE INDEX "impact_measurement_outcome_id_idx" ON "impact_measurement" ("outcome_id");
CREATE INDEX "impact_measurement_organization_id_metric_type_idx" ON "impact_measurement" ("organization_id", "metric_type");

-- ═══════════════════════════════════════════════════════════════
-- decision_feedback: Decision Engine 学习入口
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE "decision_feedback" (
    "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "organization_id" TEXT NOT NULL,
    "decision_id"     TEXT,
    "action_id"       TEXT,
    "outcome_id"      TEXT REFERENCES "outcome_record"("id") ON DELETE SET NULL,
    "feedback_type"   TEXT NOT NULL DEFAULT 'UNKNOWN',
    "feedback_data"   JSONB NOT NULL DEFAULT '{}',
    "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "decision_feedback_organization_id_idx" ON "decision_feedback" ("organization_id");
CREATE INDEX "decision_feedback_decision_id_idx" ON "decision_feedback" ("decision_id");
CREATE INDEX "decision_feedback_action_id_idx" ON "decision_feedback" ("action_id");
CREATE INDEX "decision_feedback_outcome_id_idx" ON "decision_feedback" ("outcome_id");
CREATE INDEX "decision_feedback_feedback_type_idx" ON "decision_feedback" ("feedback_type");

-- ═══════════════════════════════════════════════════════════════
-- Tenant Isolation Verification
-- ═══════════════════════════════════════════════════════════════
-- All three tables use organizationId as isolation key
-- Forbidden patterns (OI-01 Compliance):
--   ❌ userId → ownership
--   ❌ user.id as organization_id fallback
--   ❌ client-supplied organizationId from body
--   ❌ tenantId as primary isolation key
