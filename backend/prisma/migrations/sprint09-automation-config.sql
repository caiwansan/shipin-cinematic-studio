-- Sprint-09: Recruitment Automation Config Table
-- 企业招聘自动化配置表

CREATE TABLE IF NOT EXISTS recruitment_automation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL UNIQUE REFERENCES enterprise_job_workspace(id),
    enterprise_id UUID NOT NULL,
    auto_jd_generation BOOLEAN DEFAULT false,
    auto_talent_search BOOLEAN DEFAULT false,
    auto_match_filtering BOOLEAN DEFAULT false,
    auto_interview_scheduling BOOLEAN DEFAULT false,
    match_threshold INTEGER DEFAULT 70,
    notify_on_match BOOLEAN DEFAULT true,
    notify_on_interview BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_automation_config_enterprise ON recruitment_automation_config(enterprise_id);
