-- Sprint 07 Week 3: Add missing indexes for recruitment tables
-- Performance optimization for Pipeline, JobPosting, CandidateMatch queries

-- RecruitmentPipeline indexes
CREATE INDEX IF NOT EXISTS "recruitment_pipeline_workspace_id_idx" ON "recruitment_pipeline" ("workspace_id");
CREATE INDEX IF NOT EXISTS "recruitment_pipeline_job_id_idx" ON "recruitment_pipeline" ("job_id");
CREATE INDEX IF NOT EXISTS "recruitment_pipeline_stage_idx" ON "recruitment_pipeline" ("stage");
CREATE INDEX IF NOT EXISTS "recruitment_pipeline_workspace_stage_idx" ON "recruitment_pipeline" ("workspace_id", "stage");

-- CandidateMatch indexes
CREATE INDEX IF NOT EXISTS "candidate_match_workspace_id_idx" ON "candidate_match" ("workspace_id");
CREATE INDEX IF NOT EXISTS "candidate_match_job_id_idx" ON "candidate_match" ("job_id");
CREATE INDEX IF NOT EXISTS "candidate_match_candidate_id_idx" ON "candidate_match" ("candidate_id");
CREATE INDEX IF NOT EXISTS "candidate_match_workspace_job_idx" ON "candidate_match" ("workspace_id", "job_id");

-- JobPosting indexes
CREATE INDEX IF NOT EXISTS "job_posting_enterprise_id_idx" ON "job_posting" ("enterpriseId");
CREATE INDEX IF NOT EXISTS "job_posting_enterprise_status_idx" ON "job_posting" ("enterpriseId", "status");
CREATE INDEX IF NOT EXISTS "job_posting_status_idx" ON "job_posting" ("status");

-- PipelineEvent indexes
CREATE INDEX IF NOT EXISTS "pipeline_event_pipeline_id_idx" ON "pipeline_event" ("pipeline_id");
CREATE INDEX IF NOT EXISTS "pipeline_event_pipeline_created_idx" ON "pipeline_event" ("pipeline_id", "created_at");
