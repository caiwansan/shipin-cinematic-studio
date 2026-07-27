-- KM-AI-JOB-WORKSPACE-01 — 昆仑镜 AI 求职招聘工作台数据库迁移
-- 创建时间: 2026-07-22
-- 只新增表，不影响现有数据

-- 求职者档案
CREATE TABLE IF NOT EXISTS "job_candidate" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES "User"(id) ON DELETE CASCADE,
    education TEXT,
    skills TEXT[] DEFAULT '{}',
    experience TEXT,
    city TEXT,
    salary_expectation TEXT,
    career_goal TEXT,
    profile_json JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_candidate_user_id_idx" ON "job_candidate"(user_id);
CREATE INDEX IF NOT EXISTS "job_candidate_city_idx" ON "job_candidate"(city);

-- 企业画像
CREATE TABLE IF NOT EXISTS "job_company_profile" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL UNIQUE REFERENCES "enterprise_profile"(id) ON DELETE CASCADE,
    industry TEXT,
    scale TEXT,
    credit_score INT DEFAULT 0,
    quality_score INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_company_profile_enterprise_id_idx" ON "job_company_profile"(enterprise_id);

-- 岗位表
CREATE TABLE IF NOT EXISTS "job_posting" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL REFERENCES "job_company_profile"(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    salary TEXT,
    location TEXT,
    description TEXT,
    requirements TEXT,
    quality_score INT DEFAULT 0,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_posting_enterprise_id_idx" ON "job_posting"(enterprise_id);
CREATE INDEX IF NOT EXISTS "job_posting_status_idx" ON "job_posting"(status);
CREATE INDEX IF NOT EXISTS "job_posting_location_idx" ON "job_posting"(location);

-- 岗位匹配记录
CREATE TABLE IF NOT EXISTS "job_recommendation" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID NOT NULL REFERENCES "job_candidate"(id) ON DELETE CASCADE,
    job_id UUID NOT NULL REFERENCES "job_posting"(id) ON DELETE CASCADE,
    match_score INT DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_recommendation_candidate_id_idx" ON "job_recommendation"(candidate_id);
CREATE INDEX IF NOT EXISTS "job_recommendation_job_id_idx" ON "job_recommendation"(job_id);
CREATE INDEX IF NOT EXISTS "job_recommendation_match_score_idx" ON "job_recommendation"(match_score);

-- 招聘动态
CREATE TABLE IF NOT EXISTS "job_news" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    source TEXT,
    view_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_news_category_idx" ON "job_news"(category);
CREATE INDEX IF NOT EXISTS "job_news_created_at_idx" ON "job_news"(created_at);

-- 企业招聘配额
CREATE TABLE IF NOT EXISTS "job_enterprise_quota" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enterprise_id UUID NOT NULL UNIQUE REFERENCES "enterprise_profile"(id) ON DELETE CASCADE,
    posting_limit INT DEFAULT 5,
    resume_quota INT DEFAULT 100,
    agent_access BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "job_enterprise_quota_enterprise_id_idx" ON "job_enterprise_quota"(enterprise_id);

-- 添加外键关系到 User 表（如果不存在）
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_candidate_user_id_fkey') THEN
        ALTER TABLE "job_candidate" ADD CONSTRAINT "job_candidate_user_id_fkey" FOREIGN KEY (user_id) REFERENCES "User"(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 添加外键关系到 EnterpriseProfile 表（如果不存在）
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_company_profile_enterprise_id_fkey') THEN
        ALTER TABLE "job_company_profile" ADD CONSTRAINT "job_company_profile_enterprise_id_fkey" FOREIGN KEY (enterprise_id) REFERENCES "enterprise_profile"(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'job_enterprise_quota_enterprise_id_fkey') THEN
        ALTER TABLE "job_enterprise_quota" ADD CONSTRAINT "job_enterprise_quota_enterprise_id_fkey" FOREIGN KEY (enterprise_id) REFERENCES "enterprise_profile"(id) ON DELETE CASCADE;
    END IF;
END $$;
