-- Phase 1a: Stage 1 — Schema Expansion
-- Applied: 2026-07-18
-- This is the canonical migration SQL. Fix table names to match actual DB.

-- === Project 表扩展 ===
ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID,
  ADD COLUMN IF NOT EXISTS "ownerId" UUID,
  ADD COLUMN IF NOT EXISTS "type" TEXT,
  ADD COLUMN IF NOT EXISTS "resourceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastExecutionAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "Project_tenantId_idx" ON "Project"("tenantId");
CREATE INDEX IF NOT EXISTS "Project_type_idx" ON "Project"("type");

-- === GeoProjectProfile 新建 ===
CREATE TABLE IF NOT EXISTS "kmki_geo_project_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "projectId" UUID NOT NULL,
    "website" TEXT,
    "domain" TEXT,
    "brand" TEXT,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "country" TEXT,
    "industry" TEXT,
    "topic" TEXT,
    "geoConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeoProjectProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GeoProjectProfile_projectId_key" ON "kmki_geo_project_profiles"("projectId");
CREATE INDEX IF NOT EXISTS "GeoProjectProfile_projectId_idx" ON "kmki_geo_project_profiles"("projectId");

-- === GEO 子表加 tenantId ===
ALTER TABLE "kmki_geo_entities" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_entity_relations" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_project_versions" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_claims" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_evidences" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_citations" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_faqs" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_schema_markups" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_review_queue" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_quality_scores" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_freshness_records" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_benchmark_records" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "tenantId" UUID;
ALTER TABLE "kmki_geo_optimization_histories" ADD COLUMN IF NOT EXISTS "tenantId" UUID;

-- === Indexes on tenantId for key tables ===
CREATE INDEX IF NOT EXISTS "kmki_geo_entities_tenantId_idx" ON "kmki_geo_entities"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_claims_tenantId_idx" ON "kmki_geo_claims"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_evidences_tenantId_idx" ON "kmki_geo_evidences"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_citations_tenantId_idx" ON "kmki_geo_citations"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_faqs_tenantId_idx" ON "kmki_geo_faqs"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_review_queue_tenantId_idx" ON "kmki_geo_review_queue"("tenantId");
CREATE INDEX IF NOT EXISTS "kmki_geo_optimization_histories_tenantId_idx" ON "kmki_geo_optimization_histories"("tenantId");

-- === Workspace 表扩展 ===
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "tenantId" UUID,
  ADD COLUMN IF NOT EXISTS "workspaceType" TEXT;
