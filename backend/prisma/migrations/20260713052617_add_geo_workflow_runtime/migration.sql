-- This migration creates the GEO Workspace Runtime tables.
-- Tables may already exist if previously created manually.

CREATE TABLE IF NOT EXISTS "kmki_geo_workflow_states" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'CREATED',
    "completedStages" TEXT NOT NULL DEFAULT '[]',
    "availableActions" TEXT NOT NULL DEFAULT '["START_SCAN"]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kmki_geo_workflow_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kmki_geo_scan_jobs" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "result" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kmki_geo_scan_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "kmki_brand_snapshots" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "visibility" JSONB,
    "knowledge" JSONB,
    "citation" JSONB,
    "discovery" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "kmki_brand_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "kmki_geo_workflow_states_projectId_key" ON "kmki_geo_workflow_states"("projectId");
CREATE INDEX IF NOT EXISTS "kmki_geo_scan_jobs_projectId_idx" ON "kmki_geo_scan_jobs"("projectId");
CREATE UNIQUE INDEX IF NOT EXISTS "kmki_brand_snapshots_projectId_key" ON "kmki_brand_snapshots"("projectId");

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kmki_geo_workflow_states_projectId_fkey') THEN
        ALTER TABLE "kmki_geo_workflow_states" ADD CONSTRAINT "kmki_geo_workflow_states_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "kmki_geo_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kmki_geo_scan_jobs_projectId_fkey') THEN
        ALTER TABLE "kmki_geo_scan_jobs" ADD CONSTRAINT "kmki_geo_scan_jobs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "kmki_geo_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kmki_brand_snapshots_projectId_fkey') THEN
        ALTER TABLE "kmki_brand_snapshots" ADD CONSTRAINT "kmki_brand_snapshots_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "kmki_geo_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
