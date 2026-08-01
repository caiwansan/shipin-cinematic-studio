-- CharacterMindState 心理档案快照表（Task 3：人物心理状态卡）
CREATE TABLE "character_mind_states" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "chapter_no" INTEGER NOT NULL DEFAULT 0,
    "fear" TEXT,
    "desire" TEXT,
    "belief" TEXT,
    "trauma" TEXT,
    "moral_boundary" TEXT,
    "personality_drift" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "character_mind_states_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "character_mind_states_project_id_character_id_key" ON "character_mind_states"("project_id", "character_id");
CREATE INDEX "character_mind_states_project_id_chapter_no_idx" ON "character_mind_states"("project_id", "chapter_no");
ALTER TABLE "character_mind_states" ADD CONSTRAINT "character_mind_states_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "hdz_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_mind_states" ADD CONSTRAINT "character_mind_states_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "hdz_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
