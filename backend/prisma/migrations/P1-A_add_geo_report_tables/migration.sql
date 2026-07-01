-- P1-A: Add GEO Discovery Report, Action Plan, and Verification Report tables
-- These tables store persistent copies of benchmark module results

CREATE TABLE IF NOT EXISTS "kmki_geo_discovery_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "adi" DOUBLE PRECISION NOT NULL,
    "coverageScore" DOUBLE PRECISION NOT NULL,
    "shareScore" DOUBLE PRECISION NOT NULL,
    "positionScore" DOUBLE PRECISION NOT NULL,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kmki_geo_discovery_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kmki_geo_discovery_reports_projectId_idx" ON "kmki_geo_discovery_reports"("projectId");

CREATE TABLE IF NOT EXISTS "kmki_geo_action_plans" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "discoveryReportId" TEXT,
    "planData" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kmki_geo_action_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kmki_geo_action_plans_projectId_idx" ON "kmki_geo_action_plans"("projectId");

CREATE TABLE IF NOT EXISTS "kmki_geo_verification_reports" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "beforeAdi" DOUBLE PRECISION NOT NULL,
    "afterAdi" DOUBLE PRECISION NOT NULL,
    "deltaAdi" DOUBLE PRECISION NOT NULL,
    "reportData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kmki_geo_verification_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "kmki_geo_verification_reports_projectId_idx" ON "kmki_geo_verification_reports"("projectId");
