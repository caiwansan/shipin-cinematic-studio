-- P4-04 Batch Matching + Ranking
-- Date: 2026-07-25
-- 1. Add rankingVersion to talent_match_result
-- 2. Create batch_job table

-- ============================================================
-- 1. Alter talent_match_result: add ranking_version
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'talent_match_result' AND column_name = 'ranking_version'
  ) THEN
    ALTER TABLE "talent_match_result" ADD COLUMN "ranking_version" VARCHAR(20);
  END IF;
END $$;

-- ============================================================
-- 2. Create batch_job table
-- ============================================================
CREATE TABLE IF NOT EXISTS "batch_job" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "job_requirement_id" UUID NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "total_candidates" INTEGER NOT NULL DEFAULT 0,
  "processed_count" INTEGER NOT NULL DEFAULT 0,
  "matched_count" INTEGER NOT NULL DEFAULT 0,
  "threshold" INTEGER NOT NULL DEFAULT 60,
  "max_results" INTEGER NOT NULL DEFAULT 20,
  "ranking_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
  "error_message" TEXT,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign keys
  CONSTRAINT "batch_job_job_requirement_id_fkey" FOREIGN KEY ("job_requirement_id") REFERENCES "job_requirement_profile"("id") ON DELETE CASCADE
);

-- ============================================================
-- 3. Indexes on batch_job
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_batch_job_tenant_id" ON "batch_job" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_batch_job_job_requirement_id" ON "batch_job" ("job_requirement_id");
CREATE INDEX IF NOT EXISTS "idx_batch_job_status" ON "batch_job" ("status");

-- ============================================================
-- 4. Index on talent_match_result.ranking_version
-- ============================================================
CREATE INDEX IF NOT EXISTS "idx_talent_match_result_ranking_version" ON "talent_match_result" ("ranking_version");
