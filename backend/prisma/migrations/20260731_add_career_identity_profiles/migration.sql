-- Sprint-10C: Career Identity Profile table
CREATE TABLE IF NOT EXISTS career_identity_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'collecting',
    identity JSONB NOT NULL DEFAULT '{}'::jsonb,
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    education JSONB NOT NULL DEFAULT '{}'::jsonb,
    career JSONB NOT NULL DEFAULT '{}'::jsonb,
    skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    work_experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    job_preference JSONB NOT NULL DEFAULT '{}'::jsonb,
    confirmed_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_fields TEXT[] NOT NULL DEFAULT '{}',
    completion_score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cip_user_id ON career_identity_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_cip_status ON career_identity_profiles(status, completion_score);
