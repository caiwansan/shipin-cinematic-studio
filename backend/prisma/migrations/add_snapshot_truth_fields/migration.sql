-- P0-5.1: Add Truth tracking fields to kmki_geo_score_snapshots
-- All columns are nullable for backward compatibility with existing data
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "scanId" TEXT;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "evidenceIds" JSONB DEFAULT '[]'::jsonb;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "providerVersion" TEXT;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "engineVersion" TEXT;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "responseHash" TEXT;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "sourceType" TEXT DEFAULT 'unknown'::text;
ALTER TABLE "kmki_geo_score_snapshots" ADD COLUMN IF NOT EXISTS "scoreVersion" TEXT;
