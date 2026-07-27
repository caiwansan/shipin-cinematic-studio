-- P3 Candidate Domain v1.0 — FROZEN 2026-07-25
-- 人才资产领域：Career Profile / CandidateResume / Candidate Card / Skill Graph / Career Timeline
-- 设计文档：docs/product/candidate-domain/CANDIDATE_DOMAIN_V1.md

-- ============================================================
-- 1. CareerProfile：唯一真实档案（SSOT）
-- ============================================================
CREATE TABLE "career_profile" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_id"      UUID NOT NULL,
    "user_id"           UUID NOT NULL,
    "full_name"         TEXT NOT NULL,
    "headline"          TEXT,
    "bio"               TEXT,
    "avatar_url"        TEXT,
    "email"             TEXT,
    "phone"             TEXT,
    "city"              TEXT,
    "country"           TEXT NOT NULL DEFAULT 'CN',
    "career_direction"  TEXT,
    "industry"          TEXT,
    "years_experience"  INTEGER NOT NULL DEFAULT 0,
    "current_level"     TEXT,
    "job_seeking_status" TEXT NOT NULL DEFAULT 'not_looking',
    "open_to_opportunity" BOOLEAN NOT NULL DEFAULT false,
    "visibility"        TEXT NOT NULL DEFAULT 'private',
    "completion_score"  INTEGER NOT NULL DEFAULT 0,
    "last_active_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_profile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "career_profile_candidate_id_key" ON "career_profile"("candidate_id");
CREATE UNIQUE INDEX "career_profile_user_id_key" ON "career_profile"("user_id");
CREATE INDEX "career_profile_job_seeking_status_idx" ON "career_profile"("job_seeking_status");
CREATE INDEX "career_profile_visibility_idx" ON "career_profile"("visibility");

-- ============================================================
-- 2. WorkExperience：工作经历（事实数据）
-- ============================================================
CREATE TABLE "work_experience" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"      UUID NOT NULL,
    "company"         TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "department"      TEXT,
    "employment_type" TEXT,
    "start_date"      TIMESTAMP(3) NOT NULL,
    "end_date"        TIMESTAMP(3),
    "is_current"      BOOLEAN NOT NULL DEFAULT false,
    "location"        TEXT,
    "description"     TEXT,
    "achievements"    TEXT[] NOT NULL DEFAULT '{}',
    "skills_used"     TEXT[] NOT NULL DEFAULT '{}',
    "source"          TEXT NOT NULL DEFAULT 'user',
    "verified"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_experience_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "work_experience_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE
);

CREATE INDEX "work_experience_profile_id_idx" ON "work_experience"("profile_id");
CREATE INDEX "work_experience_start_date_idx" ON "work_experience"("start_date");

-- ============================================================
-- 3. Education：教育经历（事实数据）
-- ============================================================
CREATE TABLE "education" (
    "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"  UUID NOT NULL,
    "school"      TEXT NOT NULL,
    "degree"      TEXT,
    "major"       TEXT,
    "start_date"  TIMESTAMP(3),
    "end_date"    TIMESTAMP(3),
    "gpa"         DOUBLE PRECISION,
    "description" TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "education_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "education_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE
);

CREATE INDEX "education_profile_id_idx" ON "education"("profile_id");

-- ============================================================
-- 4. CandidateResume：Career Profile 的派生视图
-- ============================================================
CREATE TABLE "candidate_resume" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"      UUID NOT NULL,
    "name"            TEXT NOT NULL,
    "language"        TEXT NOT NULL DEFAULT 'zh',
    "target_role"     TEXT,
    "version"         INTEGER NOT NULL DEFAULT 1,
    "content_json"    JSONB NOT NULL DEFAULT '{}',
    "generated_by"    TEXT NOT NULL DEFAULT 'user',
    "source_resume_id" UUID,
    "file_url"        TEXT,
    "file_format"     TEXT,
    "is_default"      BOOLEAN NOT NULL DEFAULT false,
    "status"          TEXT NOT NULL DEFAULT 'active',
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_resume_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_resume_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE,
    CONSTRAINT "candidate_resume_source_resume_id_fkey"
        FOREIGN KEY ("source_resume_id") REFERENCES "candidate_resume"("id") ON DELETE SET NULL
);

CREATE INDEX "candidate_resume_profile_id_idx" ON "candidate_resume"("profile_id");
CREATE INDEX "candidate_resume_status_idx" ON "candidate_resume"("status");

-- ============================================================
-- 5. CandidateCard：企业公开投影
-- ============================================================
CREATE TABLE "candidate_card" (
    "id"               UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"       UUID NOT NULL,
    "headline"         TEXT,
    "summary"          TEXT,
    "skill_tags"       TEXT[] NOT NULL DEFAULT '{}',
    "years_experience" INTEGER NOT NULL DEFAULT 0,
    "current_city"     TEXT,
    "current_company"  TEXT,
    "current_title"    TEXT,
    "open_to_opportunity" BOOLEAN NOT NULL DEFAULT false,
    "visibility"       TEXT NOT NULL DEFAULT 'private',
    "hidden_fields"    TEXT[] NOT NULL DEFAULT '{}',
    "ai_summary"       TEXT,
    "ai_summary_at"    TIMESTAMP(3),
    "view_count"       INTEGER NOT NULL DEFAULT 0,
    "last_viewed_at"   TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_card_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_card_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "candidate_card_profile_id_key" ON "candidate_card"("profile_id");
CREATE INDEX "candidate_card_visibility_idx" ON "candidate_card"("visibility");

-- ============================================================
-- 6. Skill：标准化技能词表
-- ============================================================
CREATE TABLE "skill" (
    "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
    "name"       TEXT NOT NULL,
    "category"   TEXT,
    "aliases"    TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "skill_name_key" ON "skill"("name");
CREATE INDEX "skill_category_idx" ON "skill"("category");

-- ============================================================
-- 7. CandidateSkill：人才技能关联
-- ============================================================
CREATE TABLE "candidate_skill" (
    "id"              UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"      UUID NOT NULL,
    "skill_id"        UUID NOT NULL,
    "level"           TEXT NOT NULL DEFAULT 'beginner',
    "confidence"      INTEGER NOT NULL DEFAULT 0,
    "source"          TEXT NOT NULL DEFAULT 'user',
    "last_assessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidate_skill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "candidate_skill_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE,
    CONSTRAINT "candidate_skill_skill_id_fkey"
        FOREIGN KEY ("skill_id") REFERENCES "skill"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "candidate_skill_profile_id_skill_id_key" ON "candidate_skill"("profile_id", "skill_id");
CREATE INDEX "candidate_skill_profile_id_idx" ON "candidate_skill"("profile_id");
CREATE INDEX "candidate_skill_skill_id_idx" ON "candidate_skill"("skill_id");

-- ============================================================
-- 8. SkillEvidence：技能证据链
-- ============================================================
CREATE TABLE "skill_evidence" (
    "id"                UUID NOT NULL DEFAULT gen_random_uuid(),
    "candidate_skill_id" UUID NOT NULL,
    "evidence_type"     TEXT NOT NULL,
    "ref_id"            UUID,
    "description"       TEXT,
    "metadata"          JSONB,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_evidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "skill_evidence_candidate_skill_id_fkey"
        FOREIGN KEY ("candidate_skill_id") REFERENCES "candidate_skill"("id") ON DELETE CASCADE
);

CREATE INDEX "skill_evidence_candidate_skill_id_idx" ON "skill_evidence"("candidate_skill_id");
CREATE INDEX "skill_evidence_evidence_type_idx" ON "skill_evidence"("evidence_type");

-- ============================================================
-- 9. CareerTimelineEvent：职业成长事件流（Append-only）
-- ============================================================
CREATE TABLE "career_timeline_event" (
    "id"                  UUID NOT NULL DEFAULT gen_random_uuid(),
    "profile_id"          UUID NOT NULL,
    "event_type"          TEXT NOT NULL,
    "title"               TEXT NOT NULL,
    "description"         TEXT,
    "organization"        TEXT,
    "occurred_at"         TIMESTAMP(3) NOT NULL,
    "granularity"         TEXT NOT NULL DEFAULT 'day',
    "related_event_id"    UUID,
    "related_skill_names" TEXT[] NOT NULL DEFAULT '{}',
    "metadata"            JSONB,
    "source"              TEXT NOT NULL DEFAULT 'user',
    "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_timeline_event_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "career_timeline_event_profile_id_fkey"
        FOREIGN KEY ("profile_id") REFERENCES "career_profile"("id") ON DELETE CASCADE
);

CREATE INDEX "career_timeline_event_profile_id_occurred_at_idx" ON "career_timeline_event"("profile_id", "occurred_at");
CREATE INDEX "career_timeline_event_event_type_idx" ON "career_timeline_event"("event_type");
