-- Phase 7F: Add JSON fields to ai_video_segments for segment runtime persistence
ALTER TABLE "ai_video_segments" ADD COLUMN IF NOT EXISTS "timeline_json" JSONB;
ALTER TABLE "ai_video_segments" ADD COLUMN IF NOT EXISTS "characters_json" JSONB;
ALTER TABLE "ai_video_segments" ADD COLUMN IF NOT EXISTS "scenes_json" JSONB;
ALTER TABLE "ai_video_segments" ADD COLUMN IF NOT EXISTS "graph_hints_json" JSONB;
ALTER TABLE "ai_video_segments" ADD COLUMN IF NOT EXISTS "continuity_json" JSONB;

-- Add composite unique constraint for upsert by projectId+segmentId
-- Clean duplicates (use text id which is the PK)
DELETE FROM "ai_video_segments" a USING (
  SELECT (array_agg(id ORDER BY id))[1] as keep_id, "projectId", "segmentId", COUNT(*)
  FROM "ai_video_segments"
  GROUP BY "projectId", "segmentId"
  HAVING COUNT(*) > 1
) b
WHERE a."projectId" = b."projectId"
  AND a."segmentId" = b."segmentId"
  AND a.id != b.keep_id;

CREATE UNIQUE INDEX IF NOT EXISTS "ai_video_segments_projectId_segmentId_key"
  ON "ai_video_segments"("projectId", "segmentId");
