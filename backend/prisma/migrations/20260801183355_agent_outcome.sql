-- SPRINT-AGENT-OUTCOME-01: 统一 Agent Outcome Layer（价值层 SSOT）
-- 禁止 Workspace 自建结果表；所有 AI 员工业务结果统一写入 agent_outcome

CREATE TABLE IF NOT EXISTS "agent_outcome" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID,
    "agent_instance_id" TEXT,
    "workspace" VARCHAR(50) NOT NULL,
    "outcome_type" VARCHAR(80) NOT NULL,
    "source_execution_id" TEXT,
    "metric_value" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_outcome_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "agent_outcome_organization_id_created_at_idx" ON "agent_outcome" ("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_outcome_user_id_created_at_idx" ON "agent_outcome" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_outcome_workspace_outcome_type_idx" ON "agent_outcome" ("workspace", "outcome_type");
CREATE INDEX IF NOT EXISTS "agent_outcome_source_execution_id_idx" ON "agent_outcome" ("source_execution_id");
