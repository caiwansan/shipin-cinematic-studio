-- GEO v4 Sprint 1 — Phase 1: Data Layer
-- All tables already exist in the database.

-- Verify: GEOScoreSnapshot has optimization_execution_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'kmki_geo_score_snapshots'
    AND column_name = 'optimization_execution_id'
  ) THEN
    ALTER TABLE "kmki_geo_score_snapshots"
    ADD COLUMN "optimization_execution_id" TEXT;
  END IF;
END $$;
