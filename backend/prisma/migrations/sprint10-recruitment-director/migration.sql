-- Sprint 10: AI Recruitment Director
-- 创建招聘计划、子任务、知识资产表

-- RecruitmentPlan: AI 招聘主管创建的招聘计划
CREATE TABLE IF NOT EXISTS "recruitment_plan" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL REFERENCES "enterprise_job_workspace"("id"),
    "enterprise_id" UUID NOT NULL,
    "goal" TEXT NOT NULL,
    "position_title" VARCHAR(200) NOT NULL,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "salary_range" VARCHAR(100),
    "location" VARCHAR(100),
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'planning',
    "summary" TEXT,
    "total_subtasks" INTEGER NOT NULL DEFAULT 0,
    "completed_subtasks" INTEGER NOT NULL DEFAULT 0,
    "recommended_candidates" JSONB,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "executed_at" TIMESTAMP WITH TIME ZONE,
    "completed_at" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS "recruitment_plan_workspace_id_status_idx" ON "recruitment_plan"("workspace_id", "status");
CREATE INDEX IF NOT EXISTS "recruitment_plan_enterprise_id_idx" ON "recruitment_plan"("enterprise_id");

-- RecruitmentPlanTask: 招聘计划的子任务
CREATE TABLE IF NOT EXISTS "recruitment_plan_task" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "plan_id" UUID NOT NULL REFERENCES "recruitment_plan"("id") ON DELETE CASCADE,
    "agent_type" VARCHAR(50) NOT NULL,
    "task_name" VARCHAR(200) NOT NULL,
    "task_description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "started_at" TIMESTAMP WITH TIME ZONE,
    "completed_at" TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS "recruitment_plan_task_plan_id_status_idx" ON "recruitment_plan_task"("plan_id", "status");
CREATE INDEX IF NOT EXISTS "recruitment_plan_task_plan_id_sort_order_idx" ON "recruitment_plan_task"("plan_id", "sort_order");

-- HiringKnowledge: 企业招聘知识资产
CREATE TABLE IF NOT EXISTS "hiring_knowledge" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL REFERENCES "enterprise_job_workspace"("id"),
    "enterprise_id" UUID NOT NULL,
    "knowledge_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" UUID,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "hiring_knowledge_workspace_id_knowledge_type_idx" ON "hiring_knowledge"("workspace_id", "knowledge_type");
CREATE INDEX IF NOT EXISTS "hiring_knowledge_enterprise_id_idx" ON "hiring_knowledge"("enterprise_id");
