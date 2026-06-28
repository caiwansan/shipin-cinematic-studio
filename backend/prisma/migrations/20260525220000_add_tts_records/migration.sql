CREATE TABLE IF NOT EXISTS "tts_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "characterName" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "sequenceIndex" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tts_records_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tts_records_project_id_character_name_idx" ON "tts_records" ("projectId", "characterName");
ALTER TABLE "tts_records" ADD CONSTRAINT "tts_records_project_id_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;
