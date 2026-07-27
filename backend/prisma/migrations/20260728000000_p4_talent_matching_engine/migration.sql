-- ============================================================
-- P4-01 Talent Matching Engine
-- 数据性质：Derived / Computed（非事实数据）
-- 策略：IF NOT EXISTS 幂等
-- ============================================================

-- ── 1. JobRequirementProfile ──
CREATE TABLE IF NOT EXISTS job_requirement_profile (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id     UUID NOT NULL,
    job_title         TEXT NOT NULL,
    job_description   TEXT,
    required_skills   JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferred_skills  JSONB,
    experience_min    INTEGER NOT NULL DEFAULT 0,
    experience_max    INTEGER,
    education_min     TEXT,
    preferred_majors  TEXT[] NOT NULL DEFAULT '{}',
    industries        TEXT[] NOT NULL DEFAULT '{}',
    employment_type   TEXT,
    location          TEXT,
    remote_option     TEXT,
    salary_min        INTEGER,
    salary_max        INTEGER,
    weights           JSONB,
    status            TEXT NOT NULL DEFAULT 'draft',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_req_enterprise ON job_requirement_profile (enterprise_id);
CREATE INDEX IF NOT EXISTS idx_job_req_status ON job_requirement_profile (status);

-- ── 2. TalentMatchResult ──
CREATE TABLE IF NOT EXISTS talent_match_result (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_requirement_id UUID NOT NULL REFERENCES job_requirement_profile(id) ON DELETE CASCADE,
    candidate_id      UUID NOT NULL,
    profile_id        UUID NOT NULL,
    score             INTEGER NOT NULL,
    breakdown         JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_skills    JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_skills    JSONB NOT NULL DEFAULT '[]'::jsonb,
    skill_gap         JSONB,
    risk_flags        JSONB,
    reasoning         TEXT,
    reasoning_at      TIMESTAMPTZ,
    rank              INTEGER,
    match_version     TEXT NOT NULL DEFAULT 'v1',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_unique ON talent_match_result (job_requirement_id, candidate_id);
CREATE INDEX IF NOT EXISTS idx_match_score ON talent_match_result (job_requirement_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_match_candidate ON talent_match_result (candidate_id);

-- ── 3. MatchEvidence ──
CREATE TABLE IF NOT EXISTS match_evidence (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_result_id   UUID NOT NULL REFERENCES talent_match_result(id) ON DELETE CASCADE,
    evidence_type     TEXT NOT NULL,
    claim             TEXT NOT NULL,
    source_type       TEXT NOT NULL,
    source_id         UUID NOT NULL,
    confidence        DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_result ON match_evidence (match_result_id);
CREATE INDEX IF NOT EXISTS idx_evidence_source ON match_evidence (source_type, source_id);
